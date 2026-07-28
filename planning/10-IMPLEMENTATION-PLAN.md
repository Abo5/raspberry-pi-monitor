# 10 — Implementation Plan

Phased delivery with a working product at each step. Track A (LAN MVP) is Phase 1
and is a subset of Track B — nothing is thrown away.

---

## 1. Phase overview

| Phase | Goal | New components | Outcome |
|---|---|---|---|
| **P0** | Confirm & scaffold | — | Pi model/OS confirmed; Agent repo + CI scaffolded. |
| **P1 — LAN MVP** | Real telemetry + shell on the same Wi-Fi | Minimal Agent; client transport swap | Real CPU/temp + a working shell from the phone on the LAN. |
| **P2 — Storage + actions + alerts** | History, allow-listed actions, rules | Agent store/actions/rules | Charts with real history; run actions; alerts fire locally. |
| **P3 — Internet + E2EE** | Reach the Pi from anywhere, privately | Rendezvous; Noise session; NAT traversal | Connect over cellular, no port-forward, E2EE. |
| **P4 — Push + widgets** | Background alerts + Home/Lock widgets | APNs wake; widget extension | Get told when something's wrong; widgets on the phone. |
| **P5 — Remote Desktop** | See/drive the Pi's GUI | capture/encode/input | The desktop, honestly streamed. |
| **P6 — Hardening + release** | Security review, multi-Pi polish, App Store | — | Shippable. |

## 2. Work breakdown

### P0 — Confirm & scaffold
- [ ] Confirm Pi model (4/5), OS (Bookworm/Trixie), and whether the store should
      live on SD or attached SSD.
- [ ] Create `agent/` Rust workspace (`cargo`, `tokio`, `rustls`, `ciborium`,
      `tracing`); CI cross-compiling for `aarch64-unknown-linux-gnu`.
- [ ] Decide storage backend (SQLite default).

### P1 — LAN MVP  → see [11-LOCAL-MVP](11-LOCAL-MVP.md) for the concrete steps
- [ ] Agent: `sampler` for the primary series (temp, cpu, mem, disk, net, load, uptime).
- [ ] Agent: local TLS HTTP/WS server implementing the [dev API](07-PROTOCOL-API.md#1-local-dev-api-track-a--mvp): `/snapshot`, `/series`, `/agent`, `WS /telemetry`, `WS /shell`, `/actions`.
- [ ] Agent: PTY shell over `WS /shell`.
- [ ] Agent: bearer-token auth + a trivial pairing (QR with `ip:port` + token).
- [ ] Client: `transport/local.ts` implementing the store-facing surface against the dev API; feature-flag to switch sim ↔ real.
- [ ] Client: real pairing screen path for LAN (scan QR → store `ip:port` + token).
- **Done when:** the app shows the Pi's real temperature/CPU live and opens a working shell, on the LAN. (FR-020,021,024,040,043,100)

### P2 — Storage + actions + alerts
- [ ] Agent: SQLite store + retention/downsampling + coverage; `/series` real history.
- [ ] Agent: action runner + root helper; `agent.toml` allow-list.
- [ ] Agent: rules engine (port `client/src/sim/rules.ts` semantics) + backtest.
- [ ] Client: point charts/actions/rules at real endpoints; remove those sims.
- **Done when:** charts show real history; actions run; a rule fires locally. (FR-022,060–065,080–082)

### P3 — Internet + E2EE
- [ ] Rendezvous service (signalling + relay + push table) — [06-RENDEZVOUS](06-RENDEZVOUS.md).
- [ ] Agent + client: Noise IK session over WebRTC DataChannel; ICE; relay fallback.
- [ ] Real pairing ceremony with fingerprint verification + biometric.
- [ ] RDV-4 no-plaintext test.
- **Done when:** connect from cellular with no port-forward; MITM at pairing is caught; relay dump has no plaintext. (FR-002–006,101,102; NFR-006,007)

### P4 — Push + widgets
- [ ] APNs empty-wake via Rendezvous; NSE enrichment composes text locally.
- [ ] WidgetKit extension (native target added to `client/ios`) rendering the selected widget designs from the gallery.
- **Done when:** an alert wakes the phone with a locally-composed notification; a widget shows fresh-with-staleness data. (FR-083,140)

### P5 — Remote Desktop
- [ ] Capture (screencopy/portal), encode (OpenH264 per the licence decision), `screen` channel.
- [ ] Input injection via `uinput` (user-session unit); gesture→input mapping.
- **Done when:** the desktop streams and is drivable; quality changes are reported. (FR-160)

### P6 — Hardening + release
- [ ] Security review against [09-SECURITY](09-SECURITY.md); systemd hardening; signed auto-update.
- [ ] Multi-Pi polish; accessibility & performance pass.
- [ ] App Store submission.

## 3. Definition of done (every phase)
- Every FR/NFR in scope maps to a passing test.
- No fabricated data paths; gaps/staleness honest.
- Client typechecks + Jest green; Agent `cargo test` green; CI builds all targets.
- Docs updated; a short demo script proving the phase.

## 4. Risk register (delivery)

| ID | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R-01 | NAT traversal fails on some networks | Med | High | Relay fallback in Rendezvous; test on varied networks early in P3. |
| R-02 | No mature Swift-native WebRTC; libwebrtc awkward under RN | Med | High | De-risk in P3 spike; the WS path (P1/P4) is load-bearing and ships first. |
| R-03 | SW H.264 too heavy on Pi 5 | Med | Med | Default 720p low-fps + damage-rects; P5 is last; benchmark first. |
| R-04 | iOS background limits break alerts/widgets | Med | Med | Empty push + short NSE; documented staleness; test on device. |
| R-05 | SD write endurance | Low | Med | Batch/rollup; optional SSD relocation. |
| R-06 | Security defect | Low | Severe | Threat-model-driven design; audited shell; external review before release. |
| R-07 | Scope creep delays P1 | Med | Med | Freeze P1 to telemetry+shell; everything else is later. |

## 5. Tooling & repo layout (target)

```
raspberry-pi-monitor/
  client/                 # iOS app (built)
  agent/                  # Rust daemon (to build)
  rendezvous/             # relay/signalling (to build, Track B)
  planning/               # this folder
  docs/                   # original deep-design spec (reference)
```
Each sub-project is independently buildable and testable with its own CI job.
