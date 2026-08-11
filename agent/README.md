# Raspberry App — Agent

The daemon that runs on your Raspberry Pi. It samples real metrics and serves
them (plus an interactive shell) over a local HTTP/WebSocket API that the iOS app
connects to. **Phase 1 (LAN MVP).** Target: **Raspberry Pi 5, Raspberry Pi OS
64-bit** (also runs on Pi 4).

## Quickest path — build & run on the Pi

On the Pi (which has plenty of power to build):

```sh
# 1) install Rust (once)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
source "$HOME/.cargo/env"

# 2) get this folder onto the Pi (git clone the repo, or scp the agent/ dir)
cd agent

# 3) run it
cargo run --release
```

On start it prints a **pairing QR** and a line like:

```
Or enter by hand:  192.168.1.42:8443   token: ABCD…
```

In the app: **add a device → “Connect to a Pi on my network”** → scan the QR, or
type the ip / port / token. That's it — live metrics + a real shell.

## Install as a service (recommended)

From the `agent/` folder on the Pi:

```sh
./install.sh
```

This builds a release binary, installs a **systemd user service**
(`raspberry-agent`), starts it, and prints the connection details. The service
restarts on failure and starts at login (with lingering enabled).

Manage it:

```sh
systemctl --user status  raspberry-agent
systemctl --user restart raspberry-agent
journalctl --user -u raspberry-agent -f     # logs (incl. the pairing QR)
```

## Cross-compiling from a Mac (optional)

Building on the Pi is simplest. To cross-compile from macOS instead, use
[`cross`](https://github.com/cross-rs/cross) (needs Docker):

```sh
cargo install cross
cross build --release --target aarch64-unknown-linux-gnu
scp target/aarch64-unknown-linux-gnu/release/raspberry-agent pi@<pi-ip>:~
```

Then run `./install.sh --binary ~/raspberry-agent` on the Pi to install the
copied binary without rebuilding.

## Configuration (Phase 1)

Configured by environment variables (Phase 2 moves to `agent.toml`):

| Var | Default | Meaning |
|---|---|---|
| `AGENT_NAME` | the hostname | Display name shown in the app |
| `AGENT_BIND` | `0.0.0.0:8443` | Listen address (LAN) |
| `AGENT_INTERVAL_S` | `5` | Sampling interval in seconds |
| `AGENT_TOKEN` | random each run | Bearer token the app must present |

The installer pins `AGENT_TOKEN` so it stays stable across restarts.

## What it serves

`GET /health · /agent · /snapshot · /series?key=&from=&to= · /actions`,
`WS /telemetry` (snapshot stream), `WS /shell` (interactive PTY). Every route
requires `Authorization: Bearer <token>` (or `?token=` for WebSockets).

## Security note (Phase 1)

The LAN MVP serves plain HTTP on your local network and authenticates with a
bearer token — good enough for a trusted home network, and the one deliberate
exception to "no inbound ports". Phase 3 replaces this with an outbound,
end-to-end-encrypted connection via the Rendezvous relay (no inbound port, works
from anywhere). See [`../planning/09-SECURITY.md`](../planning/09-SECURITY.md).
