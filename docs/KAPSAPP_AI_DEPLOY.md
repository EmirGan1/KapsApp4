# KapsAI

KapsAI opens at `/kapsapp-ai` from the desktop sidebar or the mobile **Menü**. The browser authenticates with the existing KapsApp session and streams through `POST /api/kapsapp-ai/chat`. Node forwards the validated chat to Ollama 0.40.16 at `127.0.0.1:11434` using `llama3.2:3b-instruct-q5_K_M`.

## Limits and data handling

- PM2 runs one Node worker. It accepts a single active generation across accounts and up to two queued requests by default, with up to four requests per account per minute. Stopping a reply closes the Ollama request.
- CPU threads are capped at four. The request uses a 2,048-token context, expanded to 4,096 tokens for large prompts, and a default 45-second keep-alive. The app leaves the output length to Ollama and the model. It includes at most three recent exchanges within the input byte budget. The TCP connection deadline defaults to 10 seconds and ends when the socket connects. Ollama can send HTTP headers after loading its model, so the separate first-token budget covers that wait. This budget starts at 180 seconds and allows extra time for cold models and large prompts. Token inactivity defaults to 60 seconds and the overall request limit to 420 seconds. Heartbeats keep the browser connection open.
- On Linux, the endpoint checks `MemAvailable` on admission. A cold start requires at least 2,560 MiB available by default. A loaded Llama can accept a request with at least 1 GiB available. These are admission thresholds for the VDS. Systemd applies the Ollama service limit during generation.
- The active chat is held in React memory. Navigation away, reload or **Yeni sohbet** clears the view. The endpoint reads existing authentication records. It does not store messages or sources in SQLite, browser storage or application logs. Optional `KAPSAPP_AI_METRICS=1` logs only timing and token counts.
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

These are initial systemd limits for the CPU-only 5.7 GB host. Confirm the effective settings and headroom under normal KapsApp and Desklib load. If the model is missing, use `ollama pull llama3.2:3b-instruct-q5_K_M` on the VDS. Leave existing model files in place.

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

## Verify and deploy

1. Build the candidate in a separate checkout. Use `npm ci --include=dev`, `npm run lint` and `npm run build`. On an isolated testing host, install the Playwright Chromium browser and run `npm run test:kapsapp-ai` with port 11434 free for the test server. With Ollama running, use `KAPSAPP_AI_LIVE_TEST=1 npm run test:kapsapp-ai` for the real model and bilingual checks. Desklib's tests and deployed model are covered in [AI_DETECTOR_DEPLOY.md](./AI_DETECTOR_DEPLOY.md).
2. On the VDS, keep the existing PM2 working directory, database connection and uploads. Check the incoming diff for `local.db`, `local.db-wal` and `local.db-shm` before pulling. Those paths are tracked in the repository. Retain the previous build and do not reset, clean or copy over the live SQLite files. Apply the verified code with a fast-forward pull, then run the existing update command:

   ```bash
   cd /var/www/KapsApp && npm install --include=dev && npm run build && pm2 restart kapsapp-production
   ```

3. Check the main app and Desklib. Open KapsAI with a signed-in account and verify first text appears before the answer is complete. Stop a long reply and send a new one. Try requests from two accounts during a generation. On a phone, verify the composer stays above the keyboard.
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
