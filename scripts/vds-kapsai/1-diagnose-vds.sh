#!/usr/bin/env bash
# ==============================================================================
# KapsAI & KapsApp — VDS Read-Only Diagnostic & Disk Audit Script
# Safe: Performs ZERO modifications or deletions.
# ==============================================================================
set -euo pipefail

echo "======================================================================"
echo "1. SYSTEM, VIRTUALIZATION & CPU TOPOLOGY"
echo "======================================================================"
uname -a
lscpu | grep -E "Model name|Socket|Thread|NUMA|CPU\(s\)|MHz|Virtualization|Flags" || lscpu
echo "--- CPU Flags (AVX / AVX2 / AVX512 / FMA / VNNI) ---"
grep -oE 'avx[^ ]*|fma|vnni|sse4_2' /proc/cpuinfo | sort -u | tr '\n' ' ' && echo ""
echo "--- CPU Steal & Load Average (vmstat 1 3) ---"
uptime
vmstat 1 3

echo ""
echo "======================================================================"
echo "2. CGROUP v2 & SERVICE PRIORITIES (KapsApp vs Desklib vs Ollama)"
echo "======================================================================"
stat -fc %T /sys/fs/cgroup/ || true
echo "--- ollama.service cgroup settings ---"
systemctl show ollama.service -p ActiveState,SubState,MainPID,Nice,CPUWeight,CPUQuotaPerSecUSec,AllowedCPUs,MemoryCurrent,MemoryHigh,MemoryMax,MemorySwapMax,Environment || true
echo "--- kapsapp-desklib.service cgroup settings ---"
systemctl show kapsapp-desklib.service -p ActiveState,SubState,MainPID,Nice,CPUWeight,CPUQuotaPerSecUSec,AllowedCPUs,MemoryCurrent,MemoryHigh,MemoryMax,MemorySwapMax,Environment || true
echo "--- PM2 / kapsapp-production process status ---"
pm2 jlist 2>/dev/null | node -e '
  const data = JSON.parse(require("fs").readFileSync(0, "utf8") || "[]");
  for (const app of data) {
    console.log({
      name: app.name,
      pid: app.pid,
      status: app.pm2_env?.status,
      restarts: app.pm2_env?.restart_time,
      cpu: app.monit?.cpu,
      memoryMB: app.monit?.memory ? Math.round(app.monit.memory / 1048576) : 0,
    });
  }
' || pm2 status || true

echo ""
echo "======================================================================"
echo "3. MEMORY, SWAP & PRESSURE STALL INFORMATION (PSI)"
echo "======================================================================"
free -h
swapon --show || true
sysctl vm.swappiness vm.vfs_cache_pressure || true
for psi in cpu memory io; do
  if [[ -f "/proc/pressure/$psi" ]]; then
    echo "--- /proc/pressure/$psi ---"
    cat "/proc/pressure/$psi"
  fi
done
echo "--- Top 10 Processes by RSS Memory ---"
ps -eo pid,ppid,user,ni,pcpu,pmem,rss,comm --sort=-rss | head -n 11

echo ""
echo "======================================================================"
echo "4. OLLAMA VERSION, LOADED MODELS & BIND SECURITY"
echo "======================================================================"
ollama --version || true
ss -tulpn | grep -E "11434|8765|5000|3000" || true
curl -fsS --max-time 5 http://127.0.0.1:11434/api/tags || echo "Ollama /api/tags unreachable"
echo ""
curl -fsS --max-time 5 http://127.0.0.1:11434/api/ps || echo "Ollama /api/ps unreachable"
echo ""

echo ""
echo "======================================================================"
echo "5. SAFE DISK USAGE AUDIT (READ-ONLY — NO FILES DELETED)"
echo "======================================================================"
df -h /
echo "--- Breakdown of Reclaimable / Heavy Directories ---"
for target in \
  /usr/share/ollama/.ollama/models \
  /var/log/journal \
  /var/log/nginx \
  /root/.pm2/logs \
  /root/.npm \
  /var/cache/apt/archives \
  /var/www/KapsApp/logs \
  /var/www/KapsApp/.upload-staging \
  /opt/kapsapp-desklib \
  /tmp; do
  if [[ -e "$target" ]]; then
    du -sh "$target" 2>/dev/null || true
  fi
done
journalctl --disk-usage 2>/dev/null || true
