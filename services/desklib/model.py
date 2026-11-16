"""Local Desklib inference. The custom classifier follows the MIT-licensed model card."""
import os

os.environ["HF_HUB_OFFLINE"] = "1"
os.environ["TRANSFORMERS_OFFLINE"] = "1"
os.environ["HF_HUB_DISABLE_TELEMETRY"] = "1"
os.environ["TOKENIZERS_PARALLELISM"] = "false"

import math
import re
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import torch
from lingua import Language, LanguageDetectorBuilder
from torch import nn
from transformers import AutoConfig, AutoModel, AutoTokenizer, PreTrainedModel

MODEL_ID = "desklib/ai-text-detector-v1.01"
REVISION = "5fdea974cd4287c61674951ec78803aa274e2fb7"
MAX_CHARS = 50_000
MAX_SEGMENTS = 32
MIN_WORDS = 120


class DesklibAIDetectionModel(PreTrainedModel):
    # https://huggingface.co/desklib/ai-text-detector-v1.01
    config_class = AutoConfig

    def __init__(self, config):
        super().__init__(config)
        self.model = AutoModel.from_config(config)
        self.classifier = nn.Linear(config.hidden_size, 1)
        self.post_init()

    def forward(self, input_ids, attention_mask):
        hidden = self.model(input_ids, attention_mask=attention_mask).last_hidden_state
        mask = attention_mask.unsqueeze(-1).float()
        pooled = (hidden * mask).sum(dim=1) / mask.sum(dim=1).clamp_min(1e-9)
        return self.classifier(pooled)


class PositionCachedLinear(nn.Module):
    """Reuse the projection of the model's immutable relative positions."""

    def __init__(self, linear, positions):
        super().__init__()
        self.linear = linear
        self.positions_ptr = positions.data_ptr()
        self.register_buffer("projected", linear(positions), persistent=False)

    def forward(self, inputs):
        if inputs.data_ptr() == self.positions_ptr:
            return self.projected
        return self.linear(inputs)


class Detector:
    def __init__(self):
        threads = int(os.environ.get("DESKLIB_THREADS", "2"))
        self.threads = max(1, min(threads, os.cpu_count() or 1))
        torch.set_num_threads(self.threads)
        torch.set_num_interop_threads(1)
        self.device = torch.device(os.environ.get("DESKLIB_DEVICE", "cpu"))
        path = Path(os.environ["DESKLIB_MODEL_DIR"]).resolve(strict=True)
        config = AutoConfig.from_pretrained(path, local_files_only=True, trust_remote_code=False)
        if config.architectures != ["DesklibAIDetectionModel"] or config.model_type != "deberta-v2":
            raise RuntimeError("Unexpected Desklib architecture")
        self.tokenizer = AutoTokenizer.from_pretrained(path, local_files_only=True, trust_remote_code=False, use_fast=True)
        self.model, loading = DesklibAIDetectionModel.from_pretrained(
            path, config=config, local_files_only=True, use_safetensors=True, output_loading_info=True
        )
        failures = ("missing_keys", "unexpected_keys", "mismatched_keys", "error_msgs")
        if any(loading.get(key) for key in failures):
            raise RuntimeError(f"Desklib checkpoint mismatch: {loading}")
        self.model.to(self.device).eval()
        if self.device.type == "cpu" and config.relative_attention and config.share_att_key:
            self.cache_relative_projections()
        self.segment_size = min(512, config.max_position_embeddings) - self.tokenizer.num_special_tokens_to_add()
        self.languages = (
            LanguageDetectorBuilder.from_all_languages()
            .with_low_accuracy_mode()
            .with_minimum_relative_distance(0.15)
            .build()
        )
        # Load common language tables and fault in model weights before readiness.
        self.language("In the late afternoon the neighbors walked beside the river together.")
        self.language("Akşam üzeri mahalledeki komşular nehrin kenarında birlikte yürüdüler.")
        self.score(self.tokenizer.encode("The model is ready for local inference."))

    @torch.inference_mode()
    def cache_relative_projections(self):
        # Transformers 4.51.3 slices this shared tensor and passes it through
        # the layer's query/key projections with dropout disabled in eval mode.
        encoder = self.model.model.encoder
        positions = encoder.get_rel_embedding()
        encoder.get_rel_embedding = lambda: positions
        for layer in encoder.layer:
            attention = layer.attention.self
            relative = positions[:attention.pos_ebd_size * 2].unsqueeze(0)
            attention.query_proj = PositionCachedLinear(attention.query_proj, relative)
            attention.key_proj = PositionCachedLinear(attention.key_proj, relative)

    def language(self, text):
        language = self.languages.detect_language_of(text)
        if language == Language.ENGLISH:
            return "english"
        if language == Language.TURKISH:
            return "turkish"
        return "unsupported"

    @torch.inference_mode()
    def score(self, ids, pad_to=None):
        # pad_to is only used to check parity with the model card in the benchmark.
        padding = (pad_to or len(ids)) - len(ids)
        inputs = torch.tensor([ids + [self.tokenizer.pad_token_id] * padding], device=self.device)
        attention = torch.ones_like(inputs)
        if padding:
            attention[:, -padding:] = 0
        logits = self.model(inputs, attention)
        if logits.shape != (1, 1) or not math.isfinite(logits.item()):
            raise RuntimeError("Invalid Desklib output")
        return torch.sigmoid(logits).item()

    def score_windows(self, inputs):
        if len(inputs) < 2 or self.device.type != "cpu" or self.threads != 2:
            return [self.score(ids) for ids in inputs]
        try:
            memory = re.search(r"^MemAvailable:\s+(\d+)", Path("/proc/meminfo").read_text(), re.MULTILINE)
        except OSError:
            memory = None
        if not memory or int(memory[1]) < 1024 * 1024:
            return [self.score(ids) for ids in inputs]

        # The service holds one analysis lock. Split its two CPU threads across
        # independent windows only when the host can absorb the extra workspace.
        torch.set_num_threads(1)
        try:
            with ThreadPoolExecutor(max_workers=2) as executor:
                return list(executor.map(self.score, inputs))
        finally:
            torch.set_num_threads(self.threads)

    def analyze(self, text):
        words = len(re.findall(r"\S+", text))
        language = self.language(text)
        result = {
            "model": MODEL_ID, "revision": REVISION, "words": words,
            "language": language, "tokens": 0, "truncated": False,
            "segmentAi": [], "scores": None,
        }
        if language != "english" or words < MIN_WORDS:
            return result

        encoded = self.tokenizer(text, add_special_tokens=False, return_offsets_mapping=True, verbose=False)
        ids = encoded["input_ids"]
        offsets = encoded["offset_mapping"]
        count = math.ceil(len(ids) / self.segment_size)
        if count > MAX_SEGMENTS:
            result["truncated"] = True
            return result
        # Evenly sized windows use every token and avoid undersized tails.
        size = math.ceil(len(ids) / count)
        ranges = [(start, min(start + size, len(ids))) for start in range(0, len(ids), size)]
        if count > 1 and any(self.language(text[offsets[start][0]:offsets[end - 1][1]]) != "english" for start, end in ranges):
            result["language"] = "unsupported"
            return result

        # Exact duplicate token windows share their deterministic score within this request.
        windows = [tuple(ids[start:end]) for start, end in ranges]
        unique = list(dict.fromkeys(windows))
        inputs = [self.tokenizer.build_inputs_with_special_tokens(list(window)) for window in unique]
        scores = dict(zip(unique, self.score_windows(inputs)))
        segments = [scores[window] for window in windows]
        ai = sum(score * (end - start) for score, (start, end) in zip(segments, ranges)) / len(ids)
        result.update(tokens=len(ids), scores=[1 - ai, ai], segmentAi=segments)
        return result
