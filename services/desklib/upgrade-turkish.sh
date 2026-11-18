#!/usr/bin/env bash
# Upgrade the existing KapsApp detector service with pinned BERTurk v2 weights.
set -euo pipefail
script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
repo_root=$(cd -- "$script_dir/../.." && pwd)
target=/opt/kapsapp-desklib/turkish-berturk-v2
runtime=/opt/kapsapp-desklib/venv/bin/python

[[ -x "$runtime" ]] || { echo "Mevcut dedektör Python ortamı bulunamadı." >&2; exit 1; }
bash "$script_dir/provision-model.sh" "$target" turkish
chgrp -R kapsapp-desklib "$target"
chmod 0750 "$target"
install -m 0644 "$script_dir"/{model.py,service.py,benchmark.py,turkish_text.py} /opt/kapsapp-desklib/app/
systemctl restart kapsapp-desklib

ready=false
for attempt in {1..45}; do
  if curl -fsS --max-time 3 http://127.0.0.1:8765/healthz >/dev/null; then
    ready=true
    break
  fi
  sleep 2
done
if [[ "$ready" != true ]]; then
  journalctl -u kapsapp-desklib -n 30 --no-pager
  exit 1
fi

"$runtime" - "$repo_root/tests/fixtures/ai-detector-tr-smoke.jsonl" <<'PY'
import json
import sys
import urllib.request

with open(sys.argv[1], encoding="utf-8") as handle:
    sample = json.loads(handle.readline())
request = urllib.request.Request(
    "http://127.0.0.1:8765/infer",
    data=json.dumps({"text": sample["text"]}).encode(),
    headers={"Content-Type": "application/json"},
)
with urllib.request.urlopen(request, timeout=180) as response:
    result = json.load(response)
if result.get("model") != "ads2009/turkish-ai-text-detector-berturk-v2" or result.get("scores") is None:
    raise SystemExit("Türkçe model doğrulanamadı.")
print("Türkçe BERTurk v2 kuruldu ve gerçek analiz isteği tamamlandı.")
print(json.dumps({"model": result["model"], "language": result["language"], "scores": result["scores"]}))
PY
