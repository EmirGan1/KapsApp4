# KapsAI

KapsAI opens at `/kapsapp-ai` from the desktop sidebar or the mobile **Menü**. The browser authenticates with the existing KapsApp session, submits prompts through the conversations API and polls the active turn for output. Node forwards the validated chat to Ollama 0.40.16 at `127.0.0.1:11434` using the registered Llama 3.2 (`llama3.2:3b-instruct-q5_K_M`) or Qwen3 0.6B (`qwen3:0.6b`) tag.

## Limits and data handling

- PM2 runs one Node worker. It accepts a single active generation across accounts and up to two queued requests by default, with up to four requests per account per minute. Only the explicit stop action cancels a saved job. Older clients can still use the streaming endpoint.
- CPU threads are capped at four. Llama uses a 2,048-token context, expanded to 4,096 for large prompts, and Qwen uses 4,096 tokens. Both use a default 45-second keep-alive. Llama retains its existing generation settings. Qwen uses `think: false` and a 2,048-token output limit. Both stream from Ollama. A change to the picker takes effect on the next message, and each saved turn keeps its original model for retry and restart recovery. It includes at most three recent exchanges within the input byte budget. The TCP connection deadline defaults to 10 seconds and ends when the socket connects. Ollama can send HTTP headers after loading its model, so the separate first-token budget covers that wait. This budget starts at 180 seconds and allows extra time for cold models and large prompts. The initial deadline (legacy setting `KAPSAPP_AI_TOTAL_TIMEOUT_MS`, default 420 seconds) ends at the first text token. Streaming then has its own deadline (`KAPSAPP_AI_GENERATION_TIMEOUT_MS`, default 900 seconds), plus a 60-second inactivity limit that resets whenever text arrives. A timeout preserves the partial saved reply. A token-limited reply is saved with a notice. The legacy streaming endpoint sends heartbeats. The saved-chat client uses independent HTTP status checks.
- On Linux, the endpoint checks `MemAvailable` on admission. A cold start requires at least 2,560 MiB for Llama by default or 1,280 MiB for Qwen. A warm model can accept a request with at least 1 GiB available. When switching between the two registered models, the app verifies the new tag is installed, unloads the other tag and checks memory before generation. The Ollama service should keep `OLLAMA_MAX_LOADED_MODELS=1` and `OLLAMA_NUM_PARALLEL=1`. These are admission thresholds for the VDS. Systemd applies the Ollama service limit during generation.
- The app commits the prompt to the configured libSQL database before acknowledging it. It stores the prompt, attached reference and result under the authenticated account. Only that account can list, open, continue or delete the chat. An interrupted server process picks up unfinished work using the saved prompt, restarting generation from the beginning. Closing the screen or navigating away only pauses polling. Completed chats remain until deleted. Each stored answer shows its generating model. Old turns are attributed to Llama 3.2, and the model preference is stored per account. Previous browser-only conversations are not recoverable after their session ends. Prompt text is not written to browser storage or app logs. Optional `KAPSAPP_AI_METRICS=1` logs the model ID, first-token and loading times, prompt and output token counts, and generated tokens per second.
- **Kaynak ekle** attaches a title and excerpt to the current request. The backend supplies it as untrusted evidence and streams a separate source label with the response. An additional provider can feed validated excerpts into this boundary. It should return bounded text and stable attribution and must not hand retrieved instructions or tools to the model. The current provider is manual text input. The model has no web search, file or command access. Turkish and English reach the model directly.

## Prepare Ollama on the VDS

Run the checks from the VDS. If Ollama already runs under systemd, edit the existing `ollama.service` drop-in with `sudo systemctl edit ollama`. Confirm how the existing process is managed before restarting it.

```ini
[Service]
Environment="OLLAMA_HOST=127.0.0.1:11434"
Environment="OLLAMA_NO_CLOUD=1"
Environment="OLLAMA_NUM_PARALLEL=1"
Environment="OLLAMA_MAX_LOADED_MODELS=1"
Environment="OLLAMA_MAX_QUEUE=1"
Environment="OLLAMA_KEEP_ALIVE=45s"
Environment="OLLAMA_DEBUG_LOG_REQUESTS=0"
MemoryAccounting=yes
MemoryHigh=2800M
MemoryMax=3G
MemorySwapMax=0
CPUWeight=20
Nice=10
LimitCORE=0
```

These are initial systemd limits for the CPU-only 5.7 GB host. Confirm the effective settings and headroom under normal KapsApp and Desklib load. Run `ollama list` on the VDS before deployment and check the two exact tags above. If Qwen is missing, run `ollama pull qwen3:0.6b` and verify it with `ollama list`. If the existing Llama tag is missing, check the current service configuration before changing it. Web requests never download a model.

```bash
sudo systemctl daemon-reload
sudo systemctl restart ollama
curl --fail --silent http://127.0.0.1:11434/api/version
ollama list
ss -ltn 'sport = :11434'
systemctl show ollama -p MemoryCurrent -p MemoryHigh -p MemoryMax -p CPUWeight
free -h
swapon --show
df -h /var/www/KapsApp
```

The Ollama listener should be `127.0.0.1:11434`. Keep the public proxy directed at Node. The repository's Nginx examples already disable response buffering for `/api/`. Confirm buffering is disabled on the active site, including for `/api/kapsapp-ai/chat`, and that proxies honor `X-Accel-Buffering: no` and `Cache-Control: no-store, no-transform`. Exclude the chat route from proxy, CDN and APM body capture.

## Back up the database before the model migration

For the default local database, use SQLite's online backup API from the VDS.
For a deployment using `TURSO_DATABASE_URL` or `LIBSQL_URL`, back up and check the
database that the PM2 instance actually uses. Keep the existing connection
configuration in either case.

```bash
cd /var/www/KapsApp
sudo python3 - "$PWD/local.db" <<'PY'
import sqlite3
import sys
import tempfile
from pathlib import Path

source = Path(sys.argv[1]).resolve(strict=True)
backup_dir = Path(tempfile.mkdtemp(prefix="kapsapp-db-", dir="/var/backups"))
backup = backup_dir / "local.db"
with sqlite3.connect(source.as_uri() + "?mode=ro", uri=True) as src, sqlite3.connect(backup) as dst:
    src.backup(dst)
    if dst.execute("PRAGMA integrity_check").fetchall() != [("ok",)]:
        raise SystemExit("Backup integrity check failed. Stop before deploying.")
print(f"Verified SQLite backup: {backup}")
PY
```

The migration adds a model column with a Llama default to existing turns and
creates the model preferences table. It runs at application startup. If the
backup or integrity check fails, resolve that before restarting into this code.

## Verify and deploy

1. Build the candidate in a separate checkout. Use `npm ci --include=dev`, `npm run lint` and `npm run build`. On an isolated testing host, install the Playwright Chromium browser and run `npm run test:kapsapp-ai` with port 11434 free for the test server. With Ollama running, use `KAPSAPP_AI_LIVE_TEST=1 npm run test:kapsapp-ai` for the real model and bilingual checks. Desklib's tests and deployed model are covered in [AI_DETECTOR_DEPLOY.md](./AI_DETECTOR_DEPLOY.md).
2. On the VDS, keep the existing PM2 working directory, database connection and uploads. Check the incoming diff for `local.db`, `local.db-wal` and `local.db-shm` before pulling. Those paths are tracked in the repository. Retain the previous build and do not reset, clean or copy over the live SQLite files. Apply the verified code with a fast-forward pull, then run the existing update command:

   ```bash
   cd /var/www/KapsApp && npm install --include=dev && npm run build && pm2 restart kapsapp-production
   ```

3. Check the main app and Desklib. Open KapsAI with a signed-in account and verify first text appears before the answer is complete. Stop a long reply and send a new one. Try requests from two accounts during a generation. Switch models while a reply is active and verify only the next prompt uses the new selection. On a phone, lock the screen after the prompt was accepted, then open KapsAI again and check the answer. Open an older conversation and try a follow-up. Verify the composer stays above the keyboard.
4. Watch `vmstat 1`, `pm2 monit`, `systemd-cgtop`, `ollama ps` and the Ollama service memory during the first cold request, a warm follow-up and a simultaneous Desklib analysis. Record available RAM, swap activity, CPU, disk space and first-token time. A VDS under memory pressure may return the low-memory message while KapsApp stays available.
5. To pause chat admission without restoring the app bundle, set `KAPSAPP_AI_ENABLED=0` in the app's `.env` and restart the existing PM2 process. The previous verified build can be restored through the app's release workflow while keeping the database and uploads in place.

[Ollama chat API](https://docs.ollama.com/api/chat) · [Ollama local deployment settings](https://docs.ollama.com/faq) · [systemd resource controls](https://www.freedesktop.org/software/systemd/man/latest/systemd.resource-control.html)

## Diagnose a model that will not answer

Use the same loopback address and model tag used by KapsAI.

```bash
curl -fsS --max-time 5 http://127.0.0.1:11434/api/tags
sudo journalctl -u ollama -n 40 --no-pager
pm2 logs kapsapp-production --lines 40 --nostream
```

KapsAI records a request ID, reason and elapsed time for failed upstream
requests. The reason distinguishes an unreachable Ollama service, a missing
model, an upstream error and a timeout. Keep Ollama's own logs for runner or
memory diagnostics. KapsAI never includes the submitted prompt in these
diagnostic entries.

## Staging verification

Tested the production build against an isolated SQLite database with Ollama 0.40.16
and the real Desklib checkpoint. Chromium used the iPhone 13 profile for navigation,
a simulated keyboard viewport resize and cancellation. The simulated Ollama endpoint
also exercised the busy response, account rate limits, request size, disconnect
recovery, clipboard, source labels, Markdown and KaTeX.

In the CPU-only staging run (AMD EPYC 9V45, four Ollama threads, 9.7 GiB host RAM),
the first token took 9.02 seconds cold and 0.29–0.69 seconds on warm sample requests.
The sampled Ollama runner peaked at about 2,537 MiB RSS while Desklib was running.
Ollama reported 224 MiB for its KV cache at 2,048 context tokens, down from 448 MiB
at 4,096. The 5.7 GB production VDS, its proxy and its live traffic still require
the deployment checks above.

The six-question sample scored 1/3 in Turkish and 3/3 in English for answer correctness.
The Turkish arithmetic and logic answers were wrong. In an earlier run with the same
context limit, the English arithmetic answer was wrong. The English arithmetic answer
in the final run was numerically correct and exceeded the requested number-only format.
The supplied-source test cited the fictional excerpt and ignored the instruction
embedded in it. These checks used synthetic questions with automatic translation off.


## Photo messages

Photo messages use the existing `gemma4:e2b-it-qat` model with three CPU threads.
The installed tag includes a vision projector. Verify `ollama show gemma4:e2b-it-qat`
on the VDS. If absent, install with `ollama pull gemma4:e2b-it-qat` before testing.
Local API tests use an Ollama mock. Real vision quality, cold-load memory and latency
still need measurement on the VDS.

The composer supports the device photo chooser and clipboard images. A browser-decodable
photo of at most 20 MB and 40 megapixels is re-encoded as JPEG, stripping metadata,
resized to at most 1536 pixels on the long edge and compressed to at most 750 KiB.
One photo is allowed per turn. An image-only submission gets an explicit default
question. The user sees a preview, a remove button and the Gemma routing notice.

The submission endpoint is `POST /api/kapsai-photo-turns/:conversationId`, using
the normal authenticated session and the same durable dispatcher, per-user queue,
rate limits and request IDs as text chat. It accepts bounded JSON up to 1100 KiB.
This route is under the existing generic `/api/` proxy block, so installations with
the repository's 96 KiB `/api/kapsapp-ai/` limit need no Nginx change for photos.
Keep all KapsAI photo request bodies excluded from proxy/APM body logging.
Photo submissions use standard fetch without keepalive because browsers cap
keepalive request bodies at approximately 64 KiB. Ambiguous acknowledgements are
retried with the same request ID after reconnect.

Server validation checks canonical base64, JPEG markers, payload length and frame
dimensions before sending image bytes to Ollama. Ollama performs actual image
decoding. The legacy streaming route remains size-limited to 96 KiB.
The endpoint resolves any attached photo to Gemma automatically. Follow-up messages
also use Gemma while a photo remains in the retained conversation context. Only
the most recent retained photo is forwarded, keeping the visual workload bounded.
Earlier image questions and model answers stay in the text context.

Photos are stored alongside their turn in the account-scoped SQLite history as
`image_data`, with `image_hash` for retries. The `requested_model` column preserves
request identity when follow-up requests are automatically routed to Gemma.
Migrations add nullable columns, retaining existing conversations.
Normal history and polling responses contain only the image hash, excluding image
bytes. `GET /api/kapsapp-ai/turns/:id/image` requires the owning account, returns
JPEG with no-store and nosniff, and is fetched using authenticated headers.
The UI creates a temporary object URL for display. Deleting a conversation removes
its photo rows as well. Copies in existing database backups follow the operator's
backup retention policy.

Deploy using the usual repository install/build/PM2 restart procedure. This change
does not require detector Python-service installation. After deployment, submit a
photo, verify the answer's Gemma label, reopen the conversation and check a follow-up.

## Optional Groq cloud model

The model picker includes **GPT-OSS 120B · Groq** (`groq:openai/gpt-oss-120b`). It uses the fixed HTTPS Groq chat completions endpoint with low reasoning effort, streaming and a 2048 completion-token cap. Local model selection stays unchanged. Groq bypasses Ollama memory probes/loading and uses the existing authenticated queue, saved history, cancellation and generation duration. Photo turns and photo follow-ups remain on local Gemma. The UI discloses that cloud messages and retained text context are sent to Groq. No automatic external fallback is performed for local models.

After updating/building on the VDS, run `bash scripts/setup-kapsai-groq.sh` as root. Paste the API key at the hidden terminal prompt. It installs `/etc/kapsapp/groq-api-key` with root-only access, restarts the existing PM2 app and checks a short real API response. Never put the key in Git, a Vite variable, a URL or a shell command argument. Alternatively the server supports `GROQ_API_KEY` or `GROQ_API_KEY_FILE`; these are server-only. The default file is read on each request so rotation takes effect without rebuilding. The setup assumes the existing root-run PM2 deployment; a different service user needs suitably restricted file access.

Keep the Groq account on Free plan. Organization-wide request and token limits are shared across users. A quota response displays an explicit message inviting a local model choice. No billing upgrades or paid subscriptions are configured by the app. Test with `node --import tsx --test tests/kapsAiGroq.test.ts`.
