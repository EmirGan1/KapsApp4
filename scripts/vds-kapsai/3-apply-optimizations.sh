#!/usr/bin/env bash
# ==============================================================================
# KapsAI & KapsApp — Safe Dynamic Resource & Systemd Optimization Script
# Priority Hierarchy:
#   1. KapsApp (PM2)         -> CPUWeight=200, Nice=0
#   2. Desklib AI Detector   -> CPUWeight=80,  Nice=5,  MemoryHigh=2200M, MemorySwapMax=1G
#   3. KapsAI / Ollama       -> CPUWeight=25,  Nice=10, MemoryHigh=3072M, OLLAMA_NUM_PARALLEL=1
#
# All existing unit overrides are backed up to /var/backups/kapsai-opt-<timestamp>
# before any change is applied.
# ==============================================================================
set -euo pipefail

if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
  echo "Please run as root (or with sudo): sudo bash $0" >&2
  exit 1
fi

TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="/var/backups/kapsai-opt-$TIMESTAMP"
mkdir -p "$BACKUP_DIR"
echo "[1/5] Backing up current systemd configs to $BACKUP_DIR ..."

if [[ -d /etc/systemd/system/ollama.service.d ]]; then
  cp -a /etc/systemd/system/ollama.service.d "$BACKUP_DIR/ollama.service.d"
fi
if [[ -f /etc/systemd/system/kapsapp-desklib.service ]]; then
  cp -a /etc/systemd/system/kapsapp-desklib.service "$BACKUP_DIR/kapsapp-desklib.service"
fi
if [[ -d /etc/systemd/system/kapsapp-desklib.service.d ]]; then
  cp -a /etc/systemd/system/kapsapp-desklib.service.d "$BACKUP_DIR/kapsapp-desklib.service.d"
fi
systemctl show ollama.service -p Nice,CPUWeight,CPUQuotaPerSecUSec,AllowedCPUs,MemoryHigh,MemoryMax,Environment > "$BACKUP_DIR/ollama.before.txt" || true

echo "[2/5] Configuring /etc/systemd/system/ollama.service.d/override.conf ..."
mkdir -p /etc/systemd/system/ollama.service.d
cat > /etc/systemd/system/ollama.service.d/override.conf <<'EOF'
[Service]
# Dynamic CPU sharing: Ollama uses 100% of idle vCPUs when KapsApp/Desklib are idle,
# and yields immediately when KapsApp (CPUWeight=200) or Desklib (CPUWeight=80) need CPU.
Nice=10
CPUAccounting=yes
CPUWeight=25

# Memory protection for 5.7 GiB VDS: soft-throttle Ollama above 3 GiB so KapsApp and OS never OOM.
MemoryAccounting=yes
MemoryHigh=3072M

# Strictly local bind & single-model, single-parallel queue discipline for 3-vCPU VDS.
Environment="OLLAMA_HOST=127.0.0.1:11434"
Environment="OLLAMA_NUM_PARALLEL=1"
Environment="OLLAMA_MAX_LOADED_MODELS=1"
Environment="OLLAMA_MAX_QUEUE=8"
Environment="OLLAMA_KEEP_ALIVE=45s"
EOF

echo "[3/5] Configuring kapsapp-desklib.service dynamic cgroup weight (Tier 2: CPUWeight=80, Nice=5) ..."
if systemctl list-unit-files | grep -q "^kapsapp-desklib.service"; then
  mkdir -p /etc/systemd/system/kapsapp-desklib.service.d
  cat > /etc/systemd/system/kapsapp-desklib.service.d/override.conf <<'EOF'
[Service]
CPUAccounting=yes
CPUWeight=80
CPUQuota=
Nice=5
MemoryAccounting=yes
MemoryHigh=2200M
MemoryMax=2800M
MemorySwapMax=1G
EOF
fi

echo "[4/5] Configuring PM2 / KapsApp highest CPU priority (Tier 1: CPUWeight=200, Nice=0) ..."
PM2_UNIT="$(systemctl list-unit-files | awk '/^pm2-.*\.service/ {print $1; exit}')"
if [[ -n "$PM2_UNIT" ]]; then
  cp -a "/etc/systemd/system/$PM2_UNIT.d" "$BACKUP_DIR/$PM2_UNIT.d" 2>/dev/null || true
  mkdir -p "/etc/systemd/system/$PM2_UNIT.d"
  cat > "/etc/systemd/system/$PM2_UNIT.d/override.conf" <<'EOF'
[Service]
CPUAccounting=yes
CPUWeight=200
Nice=0
EOF
fi

echo "[5/5] Reloading systemd daemon and restarting ollama.service ..."
systemctl daemon-reload
systemctl restart ollama.service
if systemctl is-active --quiet kapsapp-desklib.service; then
  systemctl restart kapsapp-desklib.service
fi
if [[ -n "$PM2_UNIT" ]] && systemctl is-active --quiet "$PM2_UNIT"; then
  systemctl reload-or-restart "$PM2_UNIT" || true
fi

echo "======================================================================"
echo "OPTIMIZATION APPLIED SUCCESSFULLY"
echo "Backup saved at: $BACKUP_DIR"
echo "Verify with:"
echo "  systemctl show ollama.service -p Nice,CPUWeight,MemoryHigh,Environment"
echo "======================================================================"
