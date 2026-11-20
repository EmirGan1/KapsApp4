#!/usr/bin/env bash
# Run on the KapsApp VDS as root. Never pass the key as a command argument.
set -euo pipefail
cd /var/www/KapsApp
if [[ ${EUID} -ne 0 ]]; then
  echo 'Bu komutu root hesabında çalıştır.' >&2
  exit 1
fi
printf 'Groq API anahtarını yapıştır (ekranda görünmez): '
IFS= read -rs GROQ_SETUP_KEY </dev/tty
printf '\n'
if [[ ! "$GROQ_SETUP_KEY" =~ ^gsk_[A-Za-z0-9_-]+$ ]]; then
  echo 'Anahtar biçimi geçersiz; hiçbir değişiklik yapılmadı.' >&2
  exit 1
fi
umask 077
install -d -m 700 /etc/kapsapp
GROQ_SETUP_TEMP=$(mktemp /etc/kapsapp/groq-api-key.XXXXXX)
trap 'rm -f "$GROQ_SETUP_TEMP"' EXIT
printf '%s' "$GROQ_SETUP_KEY" > "$GROQ_SETUP_TEMP"
unset GROQ_SETUP_KEY
mv -f "$GROQ_SETUP_TEMP" /etc/kapsapp/groq-api-key
pm2 restart kapsapp-production
node --input-type=module <<'JS'
import { readFile } from 'node:fs/promises';
const key = (await readFile('/etc/kapsapp/groq-api-key', 'utf8')).trim();
try {
  const start = performance.now();
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST', signal: AbortSignal.timeout(60000),
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'openai/gpt-oss-120b', messages: [{ role:'user', content:'Reply with exactly Ready.' }],
      reasoning_effort:'low', max_completion_tokens:256, stream:false }),
  });
  if (!response.ok) throw Error(`HTTP ${response.status}`);
  const result = await response.json();
  if (!result.choices?.[0]?.message?.content) throw Error('Boş yanıt');
  console.log(`Groq bağlantısı doğrulandı (${((performance.now()-start)/1000).toFixed(2)} sn). KapsAI menüsünde GPT-OSS 120B · Groq seç.`);
} catch(error) {
  console.error(`Groq canlı testi başarısız: ${error.message}. Anahtar güvenli dosyaya kaydedildi; yerel modeller kullanılabilir.`);
  process.exitCode=1;
}
JS
