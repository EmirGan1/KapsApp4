# KapsApp Desklib deployment

The detector runs as one independent Python process. The Node API connects directly to
`127.0.0.1:8765`. Node and Nginx remain the frontend entry points. The model is English,
uses the original tokenizer, and applies masked mean pooling and sigmoid to one logit.
The pinned [Desklib checkpoint](https://huggingface.co/desklib/ai-text-detector-v1.01/tree/5fdea974cd4287c61674951ec78803aa274e2fb7)
is MIT-licensed. Inference uses unmodified float32 weights.

## Capacity and staging

Run `free -h`, `df -h /opt`, `nproc`, and `nvidia-smi` (if installed) on the destination
under normal traffic. Verify that its effective cgroup memory and CPU limits agree with
the host results. Budget 4 GiB **available** memory, 5 GiB free disk, and at least
two CPU threads for initial staging. Keep the model offline on a host with insufficient
headroom. The existing PM2 templates mention deployments of 1–1.5 GB total RAM.

Build in a separate release directory and retain the previous release, Nginx config,
and PM2 settings for rollback. Resolve the existing SQLite and upload paths before
changing the PM2 working directory. A release directory must never be used to
reinitialize, move, overwrite, or delete the live database, WAL files, or uploads.

## Install the isolated inference service

These commands assume x86-64 Linux, Python 3.12, systemd, and the repo root as the
working directory. Run them from a staging checkout of the candidate commit.

```bash
getent passwd kapsapp-desklib >/dev/null || sudo useradd --system --no-create-home --shell /usr/sbin/nologin kapsapp-desklib
sudo install -d -m 0755 /opt/kapsapp-desklib/app
sudo install -m 0644 services/desklib/{model.py,service.py,benchmark.py,turkish_text.py} /opt/kapsapp-desklib/app/
sudo python3.12 -m venv /opt/kapsapp-desklib/venv
sudo /opt/kapsapp-desklib/venv/bin/pip install --index-url https://download.pytorch.org/whl/cpu 'torch==2.7.1'
sudo /opt/kapsapp-desklib/venv/bin/pip install -r services/desklib/requirements.txt
sudo bash services/desklib/provision-model.sh /opt/kapsapp-desklib/model
sudo chgrp -R kapsapp-desklib /opt/kapsapp-desklib/model
sudo chmod 0750 /opt/kapsapp-desklib/model
sudo install -m 0644 services/desklib/kapsapp-desklib.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl start kapsapp-desklib
curl --fail --silent http://127.0.0.1:8765/healthz
DESKLIB_LIVE_TEST=1 npm run test:ai
```

Provisioning verifies SHA-256 for every required file and renames the complete
download atomically. Rerunning it verifies existing files without downloading.
Startup rejects missing or mismatched checkpoint keys and executes a warm-up.
The service logs the warm-up time and generic failures. It has one inference slot
and no access logs. The systemd unit caps CPU and RAM, disables swapping for the
worker and binds it to loopback. Keep the loopback port private. Where IP filtering
is unavailable, check the local firewall or equivalent service isolation.

## Activate and verify

1. Run `npm ci`, `npm run lint`, `npm run test:ai`, and `npm run build` in staging.
2. Apply the detector block from the matching Nginx template to the active server and
   check `nginx -t`. Limit detector bodies to 320 KiB in memory. Disable detector
   request/response body collection and caching at every proxy, CDN and APM layer.
   Keep the active proxy configuration ready for rollback.
3. Activate the verified bundle with the existing PM2 working directory and database
   settings. Reload Nginx and restart only `kapsapp-production`. Confirm the authenticated
   detector health endpoint, a real job, re-entry from another page, and the main app.
   Enable `kapsapp-desklib` at boot after those checks succeed.
4. If the model is unavailable, detector jobs fail with a retry message. For release
   rollback, restore the previous build and matching Node dependencies through the
   existing release mechanism, restore the saved proxy config if it changed, and
   restart the corresponding processes. Stop the new systemd service if it is unused.
   Retain the older model files during the rollback window.

## Upgrade an existing detector

After deploying the matching KapsApp build, update the existing Python worker
from the repository checkout. The model and Python packages are already in place.

```bash
cd /var/www/KapsApp
sudo install -m 0644 services/desklib/{model.py,service.py} /opt/kapsapp-desklib/app/
sudo systemctl restart kapsapp-desklib
sudo systemctl status kapsapp-desklib --no-pager
curl --fail --silent --retry 5 --retry-connrefused http://127.0.0.1:8765/healthz
```

If the active Nginx site has a 128 KiB detector body limit, update only the
detector location's `client_max_body_size` and `client_body_buffer_size` to
`320k`, then run `sudo nginx -t && sudo systemctl reload nginx`.

## Limits and data handling

Authenticated accounts get one job at a time and four submissions per minute, shared
with the legacy synchronous route. Node runs one job and queues at most six.
Queued text expires after ten minutes. The inference time budget scales from
90 seconds up to eight minutes based on input length. The browser uses the
asynchronous jobs API for long analyses. Results and statuses are account-scoped, stored in Node memory for at
most 30 minutes, and may be evicted sooner under load or at restart. API responses
use no-store. The frontend restores recent jobs from Node and does not persist text
or results in browser storage. The detector uses neither SQLite nor an external
inference API.

English samples under 120 words, Turkish and unrecognized languages do not receive
scores. Inputs can contain up to 50,000 characters. Up to 32 contiguous windows of
at most 512 tokens including special tokens cover the text. The text token budget
is 16,320. An input exceeding this budget receives no partial score. CPU inference
reuses the fixed relative-position projections of the loaded checkpoint across
windows. User text and its projections are excluded from that cache. An analysis
also reuses the score of an identical token window within its own request. The
request-local lookup is released when that analysis finishes. With the default
two CPU threads and at least 1 GiB of available host memory, the worker may
score two distinct windows at once. It keeps a single analysis slot for users
and runs the windows sequentially when memory is low.

When a scored analysis finishes, KapsApp adds a generic notification for its
owner and sends Web Push to registered devices. Opening the notification leads
to the detector. The notification includes neither the input nor its score.
The model card's 0.5 cutoff describes signal direction. Window disagreement results
in an inconclusive assessment. Neither the cutoff nor the minimum length is a
locally validated accuracy threshold.

Run `services/desklib/benchmark.py` with the detector venv, model environment, and
a local JSONL corpus containing `id`, `label`, `source` and `text` per record. Use
independently labeled English records and mark edited samples separately. The command
reports aggregate raw and reported-signal errors, latencies, peak resident memory,
padding parity and repeatability without printing samples. Run an offline benchmark
on a staging host or while the inference service is stopped to avoid loading the
checkpoint twice. Test real target-domain samples before tuning presentation rules.

## Validation for this change

Benchmarked the pinned checkpoint on AMD EPYC 9V74 with PyTorch CPU, float32 and
two threads. The load-and-warm phase took 1.87 s in the standalone benchmark.
The 10 scored samples took a median 3.76 s and a maximum 11.53 s
(1,240 words, 1,429 tokens). Peak process RSS was 2.11 GiB. Measurements exclude
queueing, HTTP transfer, and polling. Initial startup varied across local runs.
Repeating the reference input and comparing it against fixed 768-token padding
both produced a score delta of 0.0 at the recorded precision.

| Samples | Result |
| --- | --- |
| Five verified human excerpts | 0 false positives out of 5 scored |
| Four fresh AI samples | 3 AI signals, 1 inconclusive, 0 human signals |
| One short verified human excerpt | Excluded before model scoring |
| One Turkish sample | Turkish identified and excluded before model scoring |
| One AI-paraphrased example | 0.4815 AI score and a human signal |

The human excerpts are from [Pride and Prejudice](https://www.gutenberg.org/ebooks/1342),
[Frankenstein](https://www.gutenberg.org/ebooks/84),
[On the Origin of Species](https://www.gutenberg.org/ebooks/1228),
[The Problems of Philosophy](https://www.gutenberg.org/ebooks/5827), and
[Moby-Dick](https://www.gutenberg.org/ebooks/2701). The AI samples were newly generated
for this test. This small corpus cannot estimate production error rates, rule out
training overlap for the published excerpts, or establish a gain over the previous detector.

A scratch comparison tested PyTorch's dynamic INT8 conversion of linear layers.
It reduced time on five scored inputs but changed the AI score for the verified
Austen excerpt from 0.4637 to 0.9999 and changed a window score by up to 0.6619.
The service uses the original float32 checkpoint. ONNX would require exporting the
custom pooling and classifier and independently checking score parity.

## CPU validation for the longer input limit

On a two-thread CPU staging run, two repeated measurements per sample gave
median inference times of 6.16 → 5.18 seconds for 4,493 characters and 15.17 →
14.38 seconds for 12,494 characters. Both samples kept their original segment
scores. A 49,996-character sample with 7,954 words completed in 54.5 seconds.
The longer run peaked at 2,064 MiB RSS. Actual VDS latency depends on CPU load.


## Turkish BERTurk v2 replacement

The Turkish route now uses
[ads2009/turkish-ai-text-detector-berturk-v2](https://huggingface.co/ads2009/turkish-ai-text-detector-berturk-v2)
at revision `bc9df3aab4cb42cf8e6bea0a7fb377b12b8bb661`, Apache-2.0.
Weights and tokenizer files are verified by `turkish-checkpoint.sha256`.
The float32 model is about 443 MB, including tokenizer and metadata, and its
classifier maps 0 to HUMAN and 1 to AI. Inference is local and uses one resident
model at a time. English continues to use Desklib.

The publisher's `tr_v2_norm_1` preparation is implemented in `turkish_text.py`,
following the [published preprocessing specification](https://huggingface.co/spaces/ads2009/sentinel-ai/blob/main/backend.py).
It normalizes Unicode and typographic punctuation, removes formatting and boilerplate,
and preserves Turkish case. Exact output parity was checked on six diagnostic samples.
Inference uses every token in balanced windows of at most 254 content tokens,
plus two special tokens. Texts below 60 normalized words receive no score.
More than 32 windows or mixed-language windows receive no score.

Signals require every window to be below 0.2 for human-like or above 0.8 for AI-like.
These are conservative product margins, without statistical calibration.
Other scored cases are inconclusive. Model scores are not percentages of AI-written
text. The interface identifies the model as experimental and warns that personal
narratives and rewritten AI text can receive a human-like signal.

### Measured diagnostic results

The exact checkpoint was run on CPU PyTorch 2.7.1 and Transformers 4.51.3
on 2026-11-18 using the production normalization and inference code.

| Sample | Verified label | AI-class score | Signal |
| --- | --- | --- | --- |
| Gençliğe Hitabe, 1927 | Human | 0.00370 | Human-like |
| Expository paragraph generated by ChatGPT | AI | 0.99823 | AI-like |
| Casual narrative generated by ChatGPT | AI | 0.00170 | Human-like, missed detection |
| Literary analysis generated by ChatGPT | AI | 0.98103 | AI-like |
| Technical explanation generated by ChatGPT | AI | 0.96849 | AI-like |
| Private user-submitted student essay, 615 words | Human, user-provided provenance | 0.01171 | Human-like |

These six samples are a diagnostic comparison, without population accuracy claims.
The user's text is excluded from repository fixtures. The five public samples are
in `tests/fixtures/ai-detector-tr-smoke.jsonl`. Sample classifications can change
across revisions, runtimes and preprocessing. The 615-word text took about 1.7 seconds
on the development CPU with the model loaded. VDS latency still needs measurement.
A second BERTurk candidate, `berturk-last`, produced disagreeing windows on the
student essay and was not selected.

The former `ertoluk/ai-metin-dedektor` checkpoint produced an AI-class score of
0.99146 on the private essay and 0.99706 on the historical speech. Cached results
from that withdrawn model remain marked unvalidated, without displayed percentages.

### Upgrade on the existing VDS

Update the repository and Node build with the established `guncelle` command,
then run the service upgrade from the repository root:

```bash
bash services/desklib/upgrade-turkish.sh
```

The upgrade downloads about 443 MB into the new
`/opt/kapsapp-desklib/turkish-berturk-v2` directory. It verifies hashes before
updating the Python service, restarts it, waits for health, and makes an actual
Turkish inference request. It uses the existing Python environment and systemd
unit. Existing model files may remain in their older directory. If using a custom
`TURKISH_DETECTOR_MODEL_DIR` service override, update it to the new versioned
directory before running the upgrade.

### Repeatable local evaluation

Use UTF-8 JSONL records with `id`, `source`, `label` (`human`, `ai`, or
`edited`), and `text`. Keep authors, documents and generating models separate
between any threshold-tuning and final evaluation sets. Include multiple genres
and generators. The benchmark leaves thresholds fixed and prints IDs and metrics
without raw text.

```bash
sudo -u kapsapp-desklib env DESKLIB_MODEL_DIR=/opt/kapsapp-desklib/model   /opt/kapsapp-desklib/venv/bin/python /opt/kapsapp-desklib/app/benchmark.py /var/www/KapsApp/tests/fixtures/ai-detector-tr-smoke.jsonl
```

Reports separate languages and include scored/skipped counts, inconclusive cases,
false positives, missed AI signals, median latency and maximum latency.
Zero-count groups have no rate. Broader independent validation remains pending.
