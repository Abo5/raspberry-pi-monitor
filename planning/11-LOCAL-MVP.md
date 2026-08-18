# 11 — Local MVP Guide (Track A, the fastest path to something real)

The concrete, minimal steps to control your **real** Pi from the app on the same
Wi-Fi — no relay, no E2EE yet, just TLS on the LAN. This is Phase 1 of the full
plan; everything here is reused later.

**Prereq to confirm:** your Pi model (4/5) and OS (Bookworm/Trixie), and that the
phone and Pi are on the same network.

---

## 1. What we build

```
iPhone app  ──HTTPS/WSS on the LAN──►  raspberry-agent (Rust) on the Pi
   (real transport module)              (minimal: sampler + dev API + PTY)
```

Only two new pieces:
1. A **minimal Agent** exposing the [local dev API](07-PROTOCOL-API.md#1-local-dev-api-track-a--mvp).
2. A **real transport module** in the client that talks to it (feature-flagged
   against the existing simulation, so the UI is unchanged).

## 2. Agent MVP — scope

Implement only:
- `sampler`: `cpu.temp_c`, `cpu.util_pct`, `mem.used_pct`, `mem.available_bytes`,
  `disk.used_pct`, `net.rx_bps`, `net.tx_bps`, `load.1m`, `sys.uptime_s`
  (read the `/proc` and `/sys` files in [05-AGENT §3](05-AGENT.md#3-metric-sources-read-at-each-cadence)).
- HTTP/WS server (axum + tokio-tungstenite, rustls TLS):
  - `GET /health`, `GET /agent`, `GET /snapshot`, `GET /series`, `GET /actions`
  - `WS /telemetry` (push a snapshot every `interval_s`)
  - `WS /shell` (spawn `bash` in a PTY, pump bytes, handle resize)
- Auth: a bearer token printed at first run.
- Pairing: print a QR containing `{ ip, port, token }` (JSON, base64). No E2EE yet.

Skip for now: SQLite history (serve a short in-memory ring for `/series`),
actions execution (return the allow-list, wire "run" in P2), rules, Rendezvous.

## 3. Agent MVP — skeleton (illustrative)

```rust
// Cargo: tokio, axum, tokio-tungstenite, rustls, serde, ciborium/serde_json,
//        sysinfo (or hand-rolled /proc reads), portable-pty, qrcode
#[tokio::main]
async fn main() {
    let cfg = Config::load();                 // agent.toml or defaults
    let store = Ring::new();                  // in-memory recent samples
    tokio::spawn(sampler_loop(store.clone(), cfg.interval_s));
    let app = Router::new()
        .route("/health", get(health))
        .route("/agent", get(agent_facts))
        .route("/snapshot", get({ let s = store.clone(); move || snapshot(s) }))
        .route("/series", get({ let s = store.clone(); move |q| series(s, q) }))
        .route("/actions", get(actions_list))
        .route("/telemetry", get(ws_telemetry))   // upgrades to WS
        .route("/shell", get(ws_shell))            // upgrades to WS, PTY
        .layer(auth_bearer(cfg.token.clone()));
    serve_tls(app, cfg.bind_addr, tls_config()).await;
    // on first run: print pairing QR { ip, port, token }
}
```

`sampler_loop` reads the files each `interval_s`, computes rates from deltas, and
pushes a `Snapshot` into the ring + to WS subscribers. `ws_shell` uses
`portable-pty` to spawn `bash`, then copies bytes both ways and applies `RESIZE`.

## 4. Client — transport swap

The app already routes everything through a small surface. Add a real transport
beside the simulation and flip a flag.

- Create `client/src/net/localTransport.ts` implementing the same functions the
  store calls today (what `client/src/sim/tunnel.ts` provides): `connect()`,
  emit snapshots into the store, open/close the shell channel, list/run actions.
- It: does `GET /agent` + `GET /snapshot`, opens `WS /telemetry` → `setStore({ snapshot })`,
  and bridges `WS /shell` to the terminal surface.
- Add `USE_REAL_TRANSPORT` (env or a dev toggle). When on, the pairing "Use a
  demo Pi" path is replaced by "scan the QR the Agent printed" → store `{ip,port,token}`
  → `localTransport.connect(...)`.
- **The screens do not change** — they read the same store fields.

## 5. Bring-up steps

1. **On the Pi:** `cargo build --release`, copy the binary over (or cross-compile
   from the Mac for `aarch64-unknown-linux-gnu`), run it. It prints a pairing QR
   and starts listening on `:8443`.
2. **On the phone:** open the app, choose "I already have the Agent running" →
   scan the QR. The app stores `ip:port + token`.
3. Watch the dashboard show your **real** temperature and CPU, and open the shell.

## 6. Acceptance (MVP done)

- [ ] Dashboard shows the Pi's real CPU/temperature/memory/disk/network, updating
      at the configured interval.
- [ ] Time-range chips work over the short in-memory history.
- [ ] The shell opens, echoes real command output (`vcgencmd measure_temp`, `htop`),
      resizes, and survives a brief disconnect.
- [ ] Disconnecting Wi-Fi shows the honest offline state; reconnecting resumes.

## 7. What P1 deliberately leaves for later

- History persistence (SQLite) → P2.
- Running Actions + rules/alerts → P2.
- Internet access, E2EE, Rendezvous, pairing fingerprint ceremony → P3.
- Push + widgets → P4. Remote Desktop → P5.

Because P1 uses the same message shapes and the same client store surface, each
later phase is an addition, not a rewrite.
