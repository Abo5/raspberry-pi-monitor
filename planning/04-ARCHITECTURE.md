# 04 — System Architecture

## 1. Component map

```
                         ┌───────────────────────────────────────────┐
                         │                iPhone Client               │
                         │  React Native (Expo) · TypeScript          │
                         │  ┌──────────┐  ┌─────────┐  ┌────────────┐ │
                         │  │  Screens │─▶│  Store  │◀─│  Transport │ │
                         │  │  (SwiftUI│  │ (zustand│  │  module    │ │
                         │  │  -style) │  │ +cache) │  │            │ │
                         │  └──────────┘  └─────────┘  └─────┬──────┘ │
                         └───────────────────────────────────┼────────┘
                             Track A (LAN, TLS/WS)  │         │ Track B (E2EE)
                    ┌──────────────────────────────┘         │
                    ▼                                          ▼
         ┌────────────────────┐                    ┌────────────────────────┐
         │   Raspberry Pi     │                    │      Rendezvous        │
         │  ┌──────────────┐  │   outbound, E2EE   │  signalling + relay    │
         │  │    Agent     │──┼───────────────────▶│  (opaque bytes only)   │
         │  │  (Rust)      │  │                    │  APNs push mapping      │
         │  ├──────────────┤  │                    └───────────┬────────────┘
         │  │ sampler      │  │                                │ APNs (empty)
         │  │ store (TSDB) │  │                                ▼
         │  │ shell mgr    │  │                          (client push)
         │  │ action runner│  │
         │  │ rules engine │  │
         │  │ identity     │  │
         │  │ transport    │  │
         │  └──────┬───────┘  │
         │   privileged helper│  (Actions: reboot, service restart)
         │   user-session unit│  (capture/input for Remote Desktop)
         └────────────────────┘
```

## 2. Client architecture (as built)

- **Screens** (`client/src/screens`) — pure presentation composing components
  from `client/src/components`, styled by design tokens in `client/src/theme`.
- **Store** (`client/src/store`) — Zustand; holds connection state, current Pi,
  snapshots, alerts, rules, actions, settings; persisted via AsyncStorage.
- **Transport** — *today* `client/src/sim/*` simulates the Agent. *Target* a
  real module with the same shape (see [TRD](03-TRD.md) TR-C01). This single
  swap turns the app from demo to real without touching screens.
- **Navigation** — react-navigation; a floating pill tab bar (Devices · Monitor
  · Control · Widgets) + Settings; deep-link scheme `pimon://`.

## 3. Agent architecture (to build)

A single async Rust process (tokio) with these modules:

| Module | Responsibility |
|---|---|
| `sampler` | Reads each metric source at its cadence; emits samples. |
| `store` | Time-series persistence + retention/downsampling + coverage intervals; query API. |
| `telemetry` | Publishes live snapshots + backfill to subscribers. |
| `shell` | Spawns/attaches PTYs as transient units; byte pump; resize; audit. |
| `actions` | Loads the allow-list; runs operations; streams progress/exit. |
| `rules` | Evaluates alert rules; persists history; backtest queries. |
| `identity` | Static keypair; trusted-device store; pairing QR; revoke/rotate. |
| `transport` | Track A TLS/WS server; Track B Rendezvous client + Noise session; channel mux. |
| `config` | Parses/reloads `agent.toml`; watches for changes. |

**Split-privilege design (TC-2, TC-3):** the main Agent runs as a user-session
service (owns the Wayland session for capture/input later); a small
**privileged helper** (root, minimal surface) executes system Actions
(reboot/service restart) over a local Unix socket with a typed, allow-listed
command set. The security model covers this boundary explicitly.

## 4. Rendezvous architecture (Track B, to build)

Stateless request handling plus one small durable table:

- **Signalling**: WebSocket; clients and Agents register by an opaque rendezvous
  id; exchange ICE candidates; the service brokers, never inspects payloads.
- **Relay**: when ICE fails, relays opaque encrypted frames (TURN-like).
- **Push mapping** (the only durable state): Agent id → APNs device token, so an
  Agent can trigger an **empty** push to wake the client. The permitted-state
  set is documented and test-enforced ([09-SECURITY](09-SECURITY.md)).

## 5. Data flow (live telemetry, Track A)

1. Client opens WS `/telemetry` to the Agent (TLS, bearer token from pairing).
2. Agent sends the latest snapshot immediately, then one per sampling interval.
3. Each snapshot: `{producedAt, values{...}, coverage{...}, staleAfter}`.
4. Client renders; if a snapshot is late (> 3× interval) it dims values and
   stamps age; if the socket drops it shows a trailing hatched gap and, on
   reconnect, requests a backfill for the missed span.

## 6. Data flow (connect from anywhere, Track B)

1. Client resolves the Agent via Rendezvous (opaque id).
2. Both gather ICE candidates; attempt a **direct** DataChannel.
3. Over that channel they run a **Noise IK** handshake (client already trusts the
   Agent's static key from pairing) → an E2EE session.
4. If direct fails, the same encrypted frames flow through the Rendezvous relay —
   still opaque to it.
5. Channels (`control`/`telemetry`/`shell`/…) are multiplexed over the session.

## 7. Deployment topology

| Component | Where | How |
|---|---|---|
| Client | App Store / TestFlight | Standard iOS distribution. |
| Agent | On each Pi | One-line installer → binary + `agent.toml` + systemd unit(s). Auto-update channel later. |
| Rendezvous | Small VPS / edge | Container or binary behind TLS; horizontally scalable; monitored. |

## 8. Technology selection rationale (summary)

- **Rust for the Agent** — memory safety on a long-running, privileged, network-
  facing daemon; small static-ish binary; excellent async.
- **RN/Expo for the client** — already built and iterating fast; one language.
- **Noise IK for E2EE** — the client knows the Agent's static key from pairing,
  which IK is designed for; minimal round-trips; forward secrecy.
- **CBOR** — compact, schema-stable, good Rust + JS support (`ciborium`/`minicbor`).
- **Rendezvous kept dumb** — the less it can do, the less it can leak; matches P1.
