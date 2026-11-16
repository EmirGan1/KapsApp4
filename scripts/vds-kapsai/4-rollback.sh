#!/usr/bin/env bash
# ==============================================================================
# KapsAI & KapsApp — One-Command Rollback Script (Section 11.6)
# Restores systemd overrides from /var/backups/kapsai-opt-* or removes overrides.
# ==============================================================================
set -euo pipefail

if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
  echo "Please run as root (or with sudo): sudo bash $0 [backup_dir]" >&2
  exit 1
fi

BACKUP_DIR="${1:-$(ls -1dt /var/backups/kapsai-opt-* 2>/dev/null | head -n 1 || true)}"

echo "Rolling back KapsAI / systemd overrides..."
rm -f /etc/systemd/system/ollama.service.d/override.conf
rm -f /etc/systemd/system/kapsapp-desklib.service.d/override.conf

PM2_UNIT="$(systemctl list-unit-files | awk '/^pm2-.*\.service/ {print $1; exit}')"
if [[ -n "$PM2_UNIT" ]]; then
  rm -f "/etc/systemd/system/$PM2_UNIT.d/override.conf"
fi

if [[ -n "$BACKUP_DIR" && -d "$BACKUP_DIR" ]]; then
  echo "Restoring backup from: $BACKUP_DIR"
  if [[ -d "$BACKUP_DIR/ollama.service.d" ]]; then
    cp -a "$BACKUP_DIR/ollama.service.d/." /etc/systemd/system/ollama.service.d/
  fi
  if [[ -f "$BACKUP_DIR/kapsapp-desklib.service" ]]; then
    cp -a "$BACKUP_DIR/kapsapp-desklib.service" /etc/systemd/system/kapsapp-desklib.service
  fi
  if [[ -d "$BACKUP_DIR/kapsapp-desklib.service.d" ]]; then
    cp -a "$BACKUP_DIR/kapsapp-desklib.service.d/." /etc/systemd/system/kapsapp-desklib.service.d/
  fi
fi

systemctl daemon-reload
systemctl restart ollama.service
if systemctl is-active --quiet kapsapp-desklib.service; then
  systemctl restart kapsapp-desklib.service
fi
echo "Rollback complete."
