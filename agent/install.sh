#!/usr/bin/env bash
# Raspberry App — one-command installer. Run this ON your Pi.
#
#   ./install.sh                        # build from source, then install
#   ./install.sh --binary /path/agent   # install a pre-built binary instead
#   ./install.sh --bind 0.0.0.0:8443    # change the listen address/port
#
# What it does:
#   • installs the Agent binary to ~/.local/bin
#   • creates a STABLE connection KEY (kept across restarts and reboots)
#   • installs a systemd --user service that runs in the BACKGROUND — it keeps
#     running after you close the terminal, restarts if it crashes, and starts
#     again on every boot. It only stops when YOU stop it.
#   • prints the KEY to paste into the app.
set -euo pipefail

BINARY=""
BIND="0.0.0.0:8443"
INTERVAL="5"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --binary) BINARY="$2"; shift 2 ;;
    --bind) BIND="$2"; shift 2 ;;
    --interval) INTERVAL="$2"; shift 2 ;;
    *) echo "unknown arg: $1"; exit 1 ;;
  esac
done

BIN_DIR="$HOME/.local/bin"
UNIT_DIR="$HOME/.config/systemd/user"
DEST="$BIN_DIR/raspberry-agent"
mkdir -p "$BIN_DIR" "$UNIT_DIR"

# 1) obtain the binary
if [[ -n "$BINARY" ]]; then
  echo "→ using provided binary: $BINARY"
  install -m 0755 "$BINARY" "$DEST"
else
  echo "→ building release binary (a few minutes on a Pi)…"
  if ! command -v cargo >/dev/null 2>&1; then
    # shellcheck disable=SC1090
    [ -f "$HOME/.cargo/env" ] && source "$HOME/.cargo/env" || {
      echo "cargo not found. Install Rust: curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y"
      exit 1
    }
  fi
  ( cd "$(dirname "$0")" && cargo build --release )
  install -m 0755 "$(dirname "$0")/target/release/raspberry-agent" "$DEST"
fi

# 2) stable token (the "key" secret). Reuse an existing one if present so the
#    key you already put in the app keeps working across reinstalls.
TOKEN_FILE="$HOME/.config/raspberry-agent/token"
mkdir -p "$(dirname "$TOKEN_FILE")"
if [[ -f "$TOKEN_FILE" ]]; then
  TOKEN="$(cat "$TOKEN_FILE")"
else
  # `tr | head` makes head close the pipe early → tr gets SIGPIPE, which trips
  # `set -o pipefail`. Disable it just for this line.
  set +o pipefail
  TOKEN="$(LC_ALL=C tr -dc 'A-HJ-NP-Z2-9' </dev/urandom | head -c 24)"
  set -o pipefail
  echo "$TOKEN" > "$TOKEN_FILE"; chmod 600 "$TOKEN_FILE"
fi

# 3) systemd --user unit — the background service
cat > "$UNIT_DIR/raspberry-agent.service" <<UNIT
[Unit]
Description=Raspberry App Agent
After=network-online.target
Wants=network-online.target
# Keep retrying forever — the agent must never stay down unless the user
# stops it themselves (app Control screen, or: systemctl --user stop raspberry-agent).
StartLimitIntervalSec=0

[Service]
ExecStart=$DEST
Environment=AGENT_BIND=$BIND
Environment=AGENT_INTERVAL_S=$INTERVAL
Environment=AGENT_TOKEN=$TOKEN
Restart=always
RestartSec=3

[Install]
WantedBy=default.target
UNIT

# 4) enable + start (linger so it runs without an active login, i.e. after you
#    close the terminal and after a reboot)
loginctl enable-linger "$USER" >/dev/null 2>&1 || true
systemctl --user daemon-reload
systemctl --user enable --now raspberry-agent

# 5) build the single connection KEY and print everything
PORT="${BIND##*:}"
IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
NAME="$(hostname)"
KEY_JSON="$(printf '{"name":"%s","ip":"%s","port":"%s","token":"%s"}' "$NAME" "${IP:-127.0.0.1}" "$PORT" "$TOKEN")"
KEY="$(printf '%s' "$KEY_JSON" | base64 | tr -d '\n')"

echo
echo "  ============================================================"
echo "   ✅ Agent installed and running in the background."
echo "      (survives closing this terminal, and restarts on boot)"
echo "  ============================================================"
echo
echo "   In the app:  add a device → \"Connect to a Pi on my network\""
echo "   → paste this KEY:"
echo
echo "   $KEY"
echo
echo "   (or enter by hand →  IP: ${IP:-<this-pi-ip>}   Port: $PORT   Token: $TOKEN)"
echo
echo "   Manage the service:"
echo "     systemctl --user status  raspberry-agent     # is it running?"
echo "     systemctl --user restart raspberry-agent     # restart"
echo "     systemctl --user stop    raspberry-agent     # stop it yourself"
echo "     journalctl --user -u raspberry-agent -f      # live logs + pairing QR"
echo "     ./uninstall.sh                               # remove completely"
echo
