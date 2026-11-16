#!/usr/bin/env bash
# ==============================================================================
# KapsAI — Real VDS Benchmark Suite (Section 3.3 & Section 9)
# Measures real tokens/s, TTFT, prompt_eval, eval_duration, RAM/Swap, and
# concurrent KapsApp + Desklib responsiveness.
# Usage:
#   bash scripts/vds-kapsai/2-benchmark-kapsai.sh [threads]
#   bash scripts/vds-kapsai/2-benchmark-kapsai.sh --matrix   # tests 1, 2, 3 threads
# ==============================================================================
set -euo pipefail

MODEL="${KAPSAPP_AI_MODEL:-llama3.2:3b-instruct-q5_K_M}"
OLLAMA_URL="http://127.0.0.1:11434/api/chat"
KAPSAPP_HEALTH_URL="${KAPSAPP_HEALTH_URL:-http://127.0.0.1:5000/api/health}"
DESKLIB_HEALTH_URL="${DESKLIB_HEALTH_URL:-http://127.0.0.1:8765/healthz}"

run_single_prompt() {
  local label="$1"
  local threads="$2"
  local num_ctx="$3"
  local prompt="$4"

  node - "$label" "$MODEL" "$OLLAMA_URL" "$threads" "$num_ctx" "$prompt" <<'EOF'
const [label, model, url, threadsArg, ctxArg, prompt] = process.argv.slice(2);
const num_thread = Number(threadsArg);
const num_ctx = Number(ctxArg);
const fs = require("node:fs");

function memSnapshot() {
  try {
    const info = fs.readFileSync("/proc/meminfo", "utf8");
    const get = key => Number(info.match(new RegExp(`^${key}:\\s+(\\d+)`, "m"))?.[1] || 0);
    return {
      availMib: Math.round(get("MemAvailable") / 1024),
      swapUsedMib: Math.round((get("SwapTotal") - get("SwapFree")) / 1024),
    };
  } catch {
    return { availMib: 0, swapUsedMib: 0 };
  }
}

(async () => {
  const beforeMem = memSnapshot();
  const t0 = performance.now();
  let ttftMs = 0;
  let answer = "";
  let finalFrame = {};
  let minAvailMib = beforeMem.availMib;
  let maxSwapUsedMib = beforeMem.swapUsedMib;

  const sampler = setInterval(() => {
    const m = memSnapshot();
    if (m.availMib < minAvailMib) minAvailMib = m.availMib;
    if (m.swapUsedMib > maxSwapUsedMib) maxSwapUsedMib = m.swapUsedMib;
  }, 200);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content: "You are KapsAI, a helpful, accurate and concise assistant. Answer in the user's language unless they request otherwise. Carefully interpret questions before answering. For calculations, verify the arithmetic before presenting the final answer.",
          },
          { role: "user", content: prompt },
        ],
        stream: true,
        keep_alive: "45s",
        options: { num_ctx, num_predict: -1, num_thread, num_gpu: 0, temperature: 0.2 },
      }),
    });

    if (!res.ok || !res.body) {
      throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let pending = "";
    for (;;) {
      const { done, value } = await reader.read();
      pending += decoder.decode(value, { stream: !done });
      const lines = pending.split("\n");
      pending = lines.pop() ?? "";
      if (done && pending.trim()) lines.push(pending);
      for (const line of lines) {
        if (!line.trim()) continue;
        const frame = JSON.parse(line);
        if (frame.message?.content) {
          if (!ttftMs) ttftMs = Math.round(performance.now() - t0);
          answer += frame.message.content;
        }
        if (frame.done) finalFrame = frame;
      }
      if (done) break;
    }

    const totalMs = Math.round(performance.now() - t0);
    const evalCount = finalFrame.eval_count || 0;
    const evalDurationNs = finalFrame.eval_duration || 0;
    const promptEvalCount = finalFrame.prompt_eval_count || 0;
    const promptEvalDurationNs = finalFrame.prompt_eval_duration || 0;
    const loadDurationNs = finalFrame.load_duration || 0;
    const tokensPerSec = evalDurationNs > 0 ? Number(((evalCount / (evalDurationNs / 1e9))).toFixed(2)) : 0;
    const promptTokensPerSec = promptEvalDurationNs > 0 ? Number(((promptEvalCount / (promptEvalDurationNs / 1e9))).toFixed(2)) : 0;

    console.log(JSON.stringify({
      test: label,
      threads: num_thread,
      num_ctx,
      ttftMs,
      totalMs,
      loadMs: Math.round(loadDurationNs / 1e6),
      prompt_eval_count: promptEvalCount,
      prompt_eval_ms: Math.round(promptEvalDurationNs / 1e6),
      prompt_tok_per_s: promptTokensPerSec,
      eval_count: evalCount,
      eval_ms: Math.round(evalDurationNs / 1e6),
      tok_per_s: tokensPerSec,
      minAvailMemMib: minAvailMib,
      maxSwapUsedMib,
      answerPreview: answer.replace(/\s+/g, " ").trim().slice(0, 140),
    }));
  } finally {
    clearInterval(sampler);
  }
})();
EOF
}

run_suite_for_threads() {
  local threads="$1"
  local ctx="${2:-2048}"
  echo "----------------------------------------------------------------------"
  echo "Running Benchmark Suite (num_thread=$threads, num_ctx=$ctx)"
  echo "----------------------------------------------------------------------"

  # Warmup / ensure model is loaded so we measure both cold and warm clearly
  run_single_prompt "Test_A_Short_TR" "$threads" "$ctx" \
    "Bir yarışta ikinci sıradaki kişiyi geçersen kaçıncı olursun?"

  run_single_prompt "Test_B_Math_TR" "$threads" "$ctx" \
    "100 TL'lik bir ürün önce %20 zamlanıp ardından zamlı fiyat üzerinden %20 indirilirse son fiyat kaç TL olur?"

  run_single_prompt "Test_C_Math_EN" "$threads" "$ctx" \
    "A product costs 100 TL. Its price increases by 20%, then decreases by 20% from the increased price. What is the final price?"

  run_single_prompt "Test_D_Long_TR" "$threads" "$ctx" \
    "Wi-Fi sinyal gücünün mesafeyle azalmasını lise düzeyinde, matematiksel modeller kullanarak açıkla."

  # Test E: Concurrent KapsAI generation + KapsApp HTTP requests + Desklib health/infer probe
  echo "--- Test E: Concurrent Load (KapsAI + KapsApp HTTP + Desklib) ---"
  (
    for _ in $(seq 1 10); do
      curl -fsS -o /dev/null -w '{"kapsapp_http_ms":%{time_total}}\n' "$KAPSAPP_HEALTH_URL" 2>/dev/null || true
      curl -fsS -o /dev/null -w '{"desklib_http_ms":%{time_total}}\n' "$DESKLIB_HEALTH_URL" 2>/dev/null || true
      sleep 0.5
    done
  ) &
  local bg_pid=$!
  run_single_prompt "Test_E_Concurrent_Load" "$threads" "$ctx" \
    "100 TL'lik bir ürün önce %20 zamlanıp ardından zamlı fiyat üzerinden %20 indirilirse son fiyat kaç TL olur?"
  wait "$bg_pid" || true

  # Test F: Idle server speed
  sleep 2
  run_single_prompt "Test_F_Idle_Server" "$threads" "$ctx" \
    "Bir yarışta ikinci sıradaki kişiyi geçersen kaçıncı olursun?"
}

if [[ "${1:-}" == "--matrix" ]]; then
  for t in 1 2 3; do
    run_suite_for_threads "$t" 2048
  done
else
  THREADS="${1:-2}"
  CTX="${2:-2048}"
  run_suite_for_threads "$THREADS" "$CTX"
fi
