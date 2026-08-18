#!/usr/bin/env bash
# Raspberry App — uninstaller. Stops and removes the background service.
# Keeps your key + database by default; pass --purge to delete those too.
set -euo pipefail

PURGE=0
[[ "${1:-}" == "--purge" ]] && PURGE=1

systemctl --user disable --now raspberry-agent 2>/dev/null || true
rm -f "$HOME/.config/systemd/user/raspberry-agent.service"
systemctl --user daemon-reload 2>/dev/null || true
rm -f "$HOME/.local/bin/raspberry-agent"

echo "→ service stopped and removed."

if [[ "$PURGE" == "1" ]]; then
  rm -rf "$HOME/.config/raspberry-agent" "$HOME/.local/share/raspberry-agent"
  echo "→ purged key + database."
else
  echo "  (kept your key + database; re-run install.sh to start again with the same key.)"
  echo "  to remove everything:  ./uninstall.sh --purge"
fi
