# 05 — Agent Specification (the daemon on the Pi)

The Agent is the core new build. This is its detailed spec: layout, metric
sources, shell, actions, config, packaging.

**Language:** Rust (stable), async via tokio. **Output:** one binary +
`agent.toml` + systemd unit(s). **Baseline:** Pi 4/5, Raspberry Pi OS 64-bit.

---

## 1. Process model

- Runs as a **user-session** systemd service (`--user`) so it can later own the
  Wayland session for capture/input.
- A separate **privileged helper** (`raspberry-agent-helper`, root) exposes a
  tiny, typed, allow-listed command surface over a local Unix socket for system
  Actions (reboot, service restart, package update). The main Agent never runs
  as root.
- `Restart=on-failure`; state (identity keys, trusted devices, TSDB, alert
  history) persisted under `~/.local/share/raspberry-agent/` (main) and
  `/var/lib/raspberry-agent/` (helper).

## 2. Suggested crate layout

```
agent/
  Cargo.toml
  src/
    main.rs           # startup, config load, task supervision
    config.rs         # agent.toml parse + hot reload
    identity.rs       # keypair, trusted devices, pairing QR, revoke/rotate
    transport/
      mod.rs          # channel mux, message framing (CBOR)
      local_tls.rs    # Track A: rustls WS server
      rendezvous.rs   # Track B: signalling client
      noise.rs        # Track B: Noise IK session
    sampler/
      mod.rs
      cpu.rs mem.rs disk.rs net.rs thermal.rs load.rs psi.rs power.rs
    store/
      mod.rs          # TSDB: write, query, retention, downsample, coverage
    telemetry.rs      # snapshot publisher + backfill
    shell.rs          # PTY spawn/attach/resize/audit
    actions.rs        # allow-list runner (talks to helper for privileged ops)
    rules.rs          # alert evaluation, history, backtest
  helper/
    src/main.rs       # privileged Action executor (root, minimal)
```

## 3. Metric sources (read at each cadence)

| Series key | Source | Unit | Cadence |
|---|---|---|---|
| `cpu.temp_c` | `/sys/class/thermal/thermal_zone0/temp` ÷ 1000 | °C | 10 s |
| `cpu.util_pct` | `/proc/stat` (delta of non-idle jiffies) | % | 10 s |
| `cpu.core_util_pct` | `/proc/stat` `cpu0..N` | % | 10 s |
| `cpu.freq_mhz` | `/sys/devices/system/cpu/cpu0/cpufreq/scaling_cur_freq` | MHz | 10 s |
| `mem.used_pct` / `mem.available_bytes` | `/proc/meminfo` | % / bytes | 10 s |
| `mem.swap_used_bytes` | `/proc/meminfo` | bytes | 30 s |
| `disk.used_pct` / `disk.free_bytes` | `statvfs` per mount | % / bytes | 60 s |
| `disk.read_bps` / `disk.write_bps` / `disk.io_util_pct` | `/proc/diskstats` deltas | B/s, % | 10 s |
| `net.rx_bps` / `net.tx_bps` | `/sys/class/net/*/statistics/{rx,tx}_bytes` deltas | B/s | 10 s |
| `net.wifi_rssi_dbm` | `/proc/net/wireless` or nl80211 | dBm | 30 s |
| `load.1m/5m/15m` | `/proc/loadavg` | count | 10 s |
| `psi.cpu/mem/io_some_avg10` | `/proc/pressure/*` | ratio | 10 s |
| `sys.uptime_s` | `/proc/uptime` | s | 60 s |
| `power.throttled` | `vcgencmd get_throttled` (mailbox) | flags | 30 s |
| `systemd.units_failed` | systemd D-Bus `NFailedUnits` | count | 30 s |

(Full list + rollup tiers in [08-DATA-MODEL](08-DATA-MODEL.md). Prefer the
single-value `/sys` files over parsing `/proc/net/dev`.)

## 4. Shell manager

- On `shell.open`, spawn `bash` in a **transient systemd unit outside the Agent
  sandbox** (`systemd-run --user --pty …`) so `sudo`, `/usr` (RO under
  `ProtectSystem=strict`), and CPU quota behave normally.
- Bi-directional byte pump over the `shell` channel; handle resize
  (`TIOCSWINSZ`/`SIGWINCH`) on cols×rows change.
- **Reattach:** keep the PTY alive for a configurable grace period after a
  transport drop; re-bind on reconnect; scrollback lives on the client and is
  never cleared by an error.
- **Audit:** append `{ts, device_id, event=open|close|resize, cols, rows}` to an
  audit log. Non-optional. Remote sessions won't show in `who`/`w`/`last`
  (PAM/utmp bypassed) — documented, not hidden.

## 5. Action runner

- Reads the allow-list from `agent.toml`. Each action:
  ```toml
  [[actions]]
  id = "restart-pihole"
  category = "Services"
  name = "Restart Pi-hole"
  command = "systemctl restart pihole-FTL"
  expected_duration_s = 4
  destructive = false
  drops_tunnel = false
  privileged = true          # routed through the root helper
  ```
- Privileged actions are executed by the helper over the local socket; the helper
  validates the id against its own copy of the allow-list (defence in depth) and
  never accepts a raw command string from the network.
- Streams progress + final `{exit_code, duration_s, stderr_tail}`.

## 6. Rules engine

- Evaluate each enabled rule against every new sample using the dwell state
  machine (mirrors `client/src/sim/rules.ts` — already unit-tested):
  fire after the predicate holds ≥ dwell; track peak; resolve when it clears.
- Persist alert history authoritatively (client can't delete).
- **Backtest:** given a rule and a range, return the spans that *would* have
  fired (mirrors `client/src/sim/backtest.ts`).

## 7. Identity & pairing

- Generate a static keypair on first run; store the private key with restrictive
  perms (and, where available, the Pi's secure element/TPM in a later phase).
- Pairing QR payload: `{ agent_static_pubkey, connection_hint (LAN ip:port and/or
  rendezvous id), pairing_nonce, expires_at }`, base32-grouped for manual entry.
- Fingerprint = a hash of the Agent static key rendered as hex + a 6-word list
  (same wordlist as the client) + optional emoji.
- Refuse pairing until NTP-synced (TC-1); pairing codes expire (10 min).
- Revoke/rotate: mutate the trusted-device set; require a live, verified session.

## 8. Configuration (`agent.toml`)

```toml
[agent]
name = "pi5-livingroom"
sampling_interval_s = 5
bind_addr = "0.0.0.0:8443"     # Track A LAN listener
log_level = "info"

[storage]
raw_retention_days = 90
rollup_retention_years = 2

[rendezvous]                    # Track B (optional)
enabled = false
url = "wss://rdv.example.com"
rendezvous_id = "…"

[[actions]]
# … as above …
```

Hot-reloaded on change (watch the file); invalid config → keep the last good one
and log an error.

## 9. Packaging & install

- Cross-compile for `aarch64-unknown-linux-gnu` (glibc).
- **Installer** (`get.sh`): download the binary, drop `agent.toml` (with sensible
  defaults + a couple of example actions), install the systemd unit(s), enable &
  start, then print the pairing QR to the terminal. Opens **no inbound port** in
  Track B; Track A binds the LAN listener (documented exception).
- Auto-update channel (later): signed releases, `systemctl` reload.

## 10. Non-functional targets

- Idle CPU < 2% of one core at 5 s sampling; RSS < 60 MB (excl. shell/desktop).
- Clean shutdown flushes the store; crash-safe writes (append + fsync policy
  tuned for SD endurance, TC-7).
- Structured logs (`tracing`), rotated; a `--diagnostics` dump for support.
