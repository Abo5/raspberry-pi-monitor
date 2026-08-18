# Raspberry App

Private, secure remote **monitoring and RDP-style control of a Raspberry Pi from
an iPhone** — live telemetry, an interactive shell, allow-listed actions, alerts,
and a real remote-desktop (see the Pi's screen and drive its mouse/keyboard).
Only your phone and your Pi hold the keys; no cloud account owns your data.

Styled after Microsoft's "Windows App": pure-black canvas, bloom-wave device
cards, a floating pill tab bar, and a royal-purple accent.

---

## Repository layout

| Path | What it is | Stack |
|---|---|---|
| [`client/`](client) | The iOS app. | React Native (Expo SDK 57) + TypeScript |
| [`agent/`](agent) | The Pi daemon: samples real metrics, serves them + an interactive shell, runs allow-listed actions, and streams the desktop + injects input. | Rust (axum, tokio) |
| [`relay/`](relay) | Zero-knowledge connection broker so a phone reaches its Pi from anywhere (multi-tenant, end-to-end encrypted). | Go (gorilla/websocket) |
| [`planning/`](planning) | Implementation-ready specs: BRD, SRS, TRD, architecture, protocol, data model, security, plan. | — |
| [`docs/`](docs) | The original deep-design specification (threat model, wire framing, design system). | — |

> **The Pi-side installer** end-users download lives in its own repo:
> [`Abo5/raspberry-pi-tool`](https://github.com/Abo5/raspberry-pi-tool) — one
> command on the Pi, prints a connection key, runs as a background service.

## What it does

- **Devices** — your paired Pis as bloom-wave cards showing live `ip:port`,
  temperature and CPU; **tap to enter the remote desktop**, long-press for
  details (editable ip/port/user/password/key, copy-to-clipboard).
- **Remote desktop (RDP-style)** — the Pi's real screen streamed live (Full HD),
  landscape, with a floating AssistiveTouch-style control that docks to any edge:
  drag = move the Pi's cursor, tap = left-click, double-tap = right-click,
  pinch = zoom; a full on-screen keyboard (incl. F1–F12) types on the Pi.
- **Monitor** — CPU, SoC temperature, memory, disk, network with sparklines,
  gauges and history; metric-detail screens with stats.
- **Control** — a real interactive shell (PTY), allow-listed actions behind a
  four-gate destructive-confirmation flow.
- **Alerts** — rules with a live backtest, an alerts list, and detail.
- **Settings** — security, appearance, data & retention, diagnostics.

## How it works

```
 iPhone app ── ws(s) ─▶ raspberry-agent (Rust, on the Pi)
   RN + TS              /snapshot /series /actions /health
                        WS /telemetry  WS /shell  WS /screen  WS /input
                        bearer-token auth · app-layer encryption (NaCl secretbox)

 for internet access (optional):
 iPhone ─▶ relay (Go, on a VPS) ◀─ agent   — routes by a public id; payloads are
                                             end-to-end encrypted, relay is blind
```

- **Screen streaming** — the agent captures the Wayland desktop with `grim`
  (native 1920×1080), encodes JPEG in-process, and pushes frames over `WS /screen`.
- **Input injection** — `WS /input` drives the Pi's real pointer via `wlrctl`
  and keyboard via `wtype` (works under labwc/wlroots as the session user).
- **Encryption** — a connection key derives a symmetric key; messages are sealed
  with NaCl `secretbox` (XSalsa20-Poly1305), verified byte-for-byte between the
  Rust agent and the tweetnacl client. The token never travels on the wire.

## Run the app (iOS Simulator)

```sh
cd client
npm install
npx expo run:ios --device "iPhone 16 Pro Max"   # native build (no Expo Go)
npm test                                         # Jest tests
```

## Run the Agent (on a Pi)

```sh
cd agent
cargo run          # prints a pairing key/QR and serves the API
# GET /snapshot /series /agent ; WS /telemetry /shell /screen /input  (bearer auth)
```
For end users, prefer the one-command installer in
[`raspberry-pi-tool`](https://github.com/Abo5/raspberry-pi-tool).

## Run the Relay (on a VPS, optional — for internet access)

```sh
cd relay
go run . -addr :8787     # zero-knowledge broker; agent + app dial out to it
```

## Principles

1. **End-to-end encrypted** — no server-side plaintext, ever.
2. **No inbound ports** on the Pi in the relay path.
3. **Explicit trust** — pairing with a verified key.
4. **The Pi is the source of truth** — history and config live on the Pi.
5. **Degrade, never fake** — gaps and staleness are shown honestly; there is no
   simulated data anywhere in the app.

## License

MIT — see [LICENSE](LICENSE).

---

## Design specifications (from the spec-first baseline)

| # | Document | Purpose |
|---|---|---|
| 00 | [Glossary](docs/00-GLOSSARY.md) | Shared vocabulary. |
| 01 | [BRD](docs/01-BRD.md) | Business requirements. |
| 02 | [SRS](docs/02-SRS.md) | Software requirements specification. |
| 03 | [Architecture](docs/03-ARCHITECTURE.md) | Components & topology. |
| 04 | [Security & E2EE](docs/04-SECURITY-E2EE.md) | Threat model & crypto. |
| 05 | [Wire Protocol](docs/05-PROTOCOL.md) | Framing & message schemas. |
| 06 | [Data Model](docs/06-DATA-MODEL.md) | Agent-side schema. |
| 07 | [UX Spec](docs/07-UX-SPEC.md) | Screen-by-screen definition. |
| 08 | [Widgets](docs/08-WIDGETS.md) | WidgetKit design. |
| 09 | [Test Plan](docs/09-TEST-PLAN.md) | 216 test cases. |
| 10 | [Roadmap](docs/10-ROADMAP.md) | M0-M6 milestones. |
