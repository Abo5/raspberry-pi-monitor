#!/usr/bin/env bash
# Raspberry App — Agent installer (Phase 1, run ON the Pi).
# Builds (or uses a provided binary), installs a systemd --user service, starts
# it, and prints the connection details for the app.
#
#   ./install.sh                       # build from source, then install
#   ./install.sh --binary /path/agent  # install a pre-built (e.g. cross-compiled) binary
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
  echo "→ building release binary (this can take a few minutes on a Pi)…"
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

# 2) stable token (kept across restarts). Reuse an existing one if present.
TOKEN_FILE="$HOME/.config/raspberry-agent/token"
mkdir -p "$(dirname "$TOKEN_FILE")"
if [[ -f "$TOKEN_FILE" ]]; then
  TOKEN="$(cat "$TOKEN_FILE")"
else
  TOKEN="$(LC_ALL=C tr -dc 'A-HJ-NP-Z2-9' </dev/urandom | head -c 24)"
  echo "$TOKEN" > "$TOKEN_FILE"; chmod 600 "$TOKEN_FILE"
fi

# 3) systemd --user unit
cat > "$UNIT_DIR/raspberry-agent.service" <<UNIT
[Unit]
Description=Raspberry App Agent
After=network-online.target

[Service]
ExecStart=$DEST
Environment=AGENT_BIND=$BIND
Environment=AGENT_INTERVAL_S=$INTERVAL
Environment=AGENT_TOKEN=$TOKEN
Restart=on-failure
RestartSec=3

[Install]
WantedBy=default.target
UNIT

# 4) enable + start (linger so it runs without an active login)
loginctl enable-linger "$USER" >/dev/null 2>&1 || true
systemctl --user daemon-reload
systemctl --user enable --now raspberry-agent

# 5) print connection details
PORT="${BIND##*:}"
IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
echo
echo "  ✅ Agent installed and running."
echo "  In the app:  add a device → \"Connect to a Pi on my network\""
echo "     IP:    ${IP:-<this-pi-ip>}"
echo "     Port:  $PORT"
echo "     Token: $TOKEN"
echo
echo "  See the pairing QR + logs:  journalctl --user -u raspberry-agent -f"
echo
