# Raspberry App

Private, secure remote **monitoring and control of a Raspberry Pi from an
iPhone** — live telemetry, an interactive shell, allow-listed actions, alerts,
widgets, and a remote-desktop-style connect flow. Only your phone and your Pi
hold the keys; no cloud account owns your data.

Styled after Microsoft's "Windows App": pure-black canvas, bloom-wave device
cards, a floating pill tab bar, and a royal-purple accent.

---

## Repository layout

| Path | What it is | Status |
|---|---|---|
| [`client/`](client) | The iOS app — React Native (Expo SDK 57) + TypeScript. | ✅ Built. Telemetry is currently **simulated** in-app; 65 unit tests. |
| [`agent/`](agent) | The Pi daemon — Rust. Samples real metrics and serves them + an interactive shell over a local HTTP/WS API. | ✅ Phase-1 built & compiles (`cargo check` clean). |
| [`rendezvous/`](planning/06-RENDEZVOUS.md) | Zero-knowledge relay so the phone reaches the Pi from anywhere. | ⬜ Spec only (Track B). |
| [`planning/`](planning) | Current, implementation-ready docs: BRD, SRS, TRD, architecture, agent/rendezvous specs, protocol, data model, security, plan, local-MVP guide. | ✅ |
| [`docs/`](docs) | The original deep-design specification (threat model, wire framing, design system) — reference. | ✅ |

## What the app does today

- **Devices** home — your paired Pis as bloom-wave cards; tap to connect.
- **Sign-in flow** — RDP-style: enter username/password (or save them and never
  be asked again), then connect straight into a remote session.
- **Monitor** — live dashboard: CPU, SoC temperature, memory, disk, network,
  with sparklines, a disk gauge, and a temperature chart with 80/85 °C
  thresholds; metric-detail screens with history + stats.
- **Control** — remote shell (interactive terminal), allow-listed actions with a
  four-gate destructive-confirmation flow, and a reboot watch that advances on
  real events.
- **Alerts** — rules with a live "would have fired N times" backtest, an alerts
  list, and detail with the data behind each fire.
- **Widgets** — a gallery of 35 Home/Lock-Screen widget designs.
- **Settings** — security, appearance, data & retention, diagnostics.

> Telemetry, the desktop stream, and the tunnel are **simulated** in the client
> today (`client/src/sim/`). The `agent/` daemon already serves **real** metrics
> and a **real** shell over its local API — wiring the client to it is the next
> step (see [`planning/11-LOCAL-MVP.md`](planning/11-LOCAL-MVP.md)).

## Run the app (iOS Simulator)

```sh
cd client
npm install
npx expo run:ios --device "iPhone 16 Pro Max"   # native build (no Expo Go)
# or, for quick JS-only iteration:
npx expo start --ios
npm test                                         # 65 Jest tests
```

## Run the Agent (on a Pi, or a host for a smoke test)

```sh
cd agent
cargo run          # prints a pairing QR { ip, port, token } and serves the API
# GET /snapshot, /series, /agent ; WS /telemetry, /shell  (bearer-token auth)
```

## Principles

1. **End-to-end encrypted** (Track B) — no server-side plaintext, ever.
2. **No inbound ports** on the Pi in the final product (the LAN MVP is the one
   documented exception).
3. **Explicit trust** — pairing with a verified key fingerprint.
4. **The Pi is the source of truth** — history and config live on the Pi.
5. **Degrade, never fake** — gaps and staleness are always shown honestly.

## Roadmap (short)

P1 LAN MVP (real telemetry + shell) → P2 storage + actions + alerts → P3 internet
+ E2EE + Rendezvous → P4 push + widgets → P5 remote desktop → P6 hardening +
release. Full plan in [`planning/10-IMPLEMENTATION-PLAN.md`](planning/10-IMPLEMENTATION-PLAN.md).

## License

MIT — see [LICENSE](LICENSE).
