# KapsApp AI Metin Dedektörü — server deployment

## Model provisioning (not tracked by Git)

The English RoBERTa INT8 model comes from `Eslzzyl/aigc-detector-en-onnx` on Hugging Face.
Its model card defines `logits = [Human_Written, AI_Generated]` (class 0 = İnsan, class 1 = AI).
The results are experimental model scores, **not** evidence or a calibrated probability.

Required files on the application server:

```
/var/www/KapsApp/models/ai-detector/model_quantized.onnx
/var/www/KapsApp/models/ai-detector/tokenizer.json
/var/www/KapsApp/models/ai-detector/tokenizer_config.json
```

The remaining config/tokenizer files already present in this directory can remain.
`models/ai-detector/` is ignored by Git. Do **not** commit the 120 MB weights or user text.
Optionally set `AI_DETECTOR_MODEL_DIR` to an absolute model folder.

The Node worker uses `@huggingface/tokenizers` + `onnxruntime-node`, already listed in `package.json`.
It does **not** import `@huggingface/transformers`, avoiding the conflicting nested native ONNX runtimes observed in the temporary CLI experiments.

## Safe rollout

1. Preserve live database and uploads; do not run `git reset --hard`, `git clean -fd`, or touch `local.db-wal`.
2. From `/var/www/KapsApp`, check `git status --short --untracked-files=no`, review any conflicts before `git pull --ff-only origin main`.
3. Verify the model is still present with `ls -lh models/ai-detector/model_quantized.onnx`.
4. Run `node scripts/test-ai-detector.mjs`. **Do not deploy** if this smoke test fails.
5. Run `npm run lint` and `npm run build`; if successful, restart only `pm2 restart kapsapp-production`.
6. Open the AI Metin Dedektörü on mobile, submit a sample and confirm the labels **İnsan / AI**. Check the result resumes after navigation and the page scrolls.

The ONNX model is loaded into RAM once at worker startup. Server-side analysis is asynchronous:
`POST /api/ai-checker/jobs` returns an opaque job ID; authenticated `GET /api/ai-checker/jobs/:id` returns
`queued`, `processing`, `done` (scores/tokens/truncation only), or `error`.
Raw text is held in memory for the active or queued task only, is not saved to the database,
and is not logged by this feature. Completed numeric results remain in server RAM for
up to 24 hours (subject to a bounded cache). The browser saves only the numeric last
result and an opaque in-progress job ID, never the input text.

Legacy `POST /api/ai-checker/analyze` remains for previously cached clients.

## Operational limits

- Input: up to 20,000 characters. The worker samples one to three independent text windows (each at most 402 tokens) instead of automatically ignoring everything after the first 512 tokens.
- Samples under 120 words, likely Turkish samples, and partially sampled long texts do not receive a categorical AI authorship verdict.
- Two or more consistent high raw scores are displayed as **unverified AI-like signals**, never definitive AI authorship. The 98% display rule is deliberately conservative but **not statistically calibrated**.
- Determining a trustworthy decision threshold requires a separate labeled set of genuine human and AI texts; check the human false-positive rate before further classification claims.
- English-only trained classifier; warn about unreliable interpretations for other languages.
- No file uploaded or model downloaded by the browser.
- Worker handles one request at a time with a bounded queue; first warmup or server load may add delay.
- Server restart or RAM cache eviction can expire unfinished or completed job IDs. No text is reconstructed.
- `node scripts/test-ai-detector.mjs` runs offline against the existing SFTP-provisioned files.
