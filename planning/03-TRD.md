# 03 — Technical Requirements Document (TRD)

How the [SRS](02-SRS.md) requirements are met technically: the stack, component
boundaries, interfaces, data, environments, and hard technical constraints.
Requirement IDs here are `TR-` and reference the `FR-`/`NFR-` they satisfy.

---

## 1. System overview

Three cooperating components:

```
┌─────────────┐        ┌──────────────────┐         ┌──────────────────┐
│  iPhone     │  E2EE  │   Rendezvous     │  E2EE   │   Raspberry Pi   │
│  Client     │◄──────►│   (relay/signal, │◄───────►│   Agent (daemon) │
│  (RN/Expo)  │        │    Track B only) │         │  + transient PTY │
└─────────────┘        └──────────────────┘         └──────────────────┘
       ▲  Track A: direct TLS over the LAN (no relay) ▲
       └───────────────────────────────────────────────┘
```

- **Client** — presentation + local cache; holds one half of the key material.
- **Agent** — the source of truth; samples metrics, stores history, runs shell &
  actions; holds the other half of the key material.
- **Rendezvous** — helps the two find each other and relays opaque bytes when a
  direct path is impossible; can never read the payload.

---

## 2. Technology stack

| Layer | Choice | Why |
|---|---|---|
| Client app | React Native + Expo (SDK 57), TypeScript | Already built; fast iteration; one codebase. |
| Client state | Zustand + AsyncStorage | Simple, testable; persistence for pairing/cache. |
| Client charts | react-native-svg (hand-rolled) | Full control of the instrument-style visuals. |
| Client tests | Jest (jest-expo) | 65 tests today; pure logic extracted for testability. |
| Agent | **Rust** (stable), single binary + systemd unit | Small footprint, memory-safe, good async (tokio). |
| Agent storage | Embedded time-series (see [08-DATA-MODEL](08-DATA-MODEL.md)) — SQLite or a rollup file store | No server dependency; bounded growth. |
| Agent transport | Track A: HTTP/1.1 + WebSocket over TLS (rustls). Track B: Noise session over WebRTC DataChannel / WebSocket. | Reuse one message layer over either transport. |
| Rendezvous | Go **or** Rust; stateless-ish; WebSocket signalling + optional relay | Simple, cheap to host. |
| Serialization | CBOR (`ciborium`/`minicbor`) for the binary protocol; JSON for the local dev API | Compact, schema-stable; `serde_cbor` is unmaintained — do not use it. |
| Crypto | Noise Protocol (IK) for Track B; TLS 1.3 for Track A; libsodium/`ring`-class primitives | Vetted, minimal. |

---

## 3. Technical requirements

### 3.1 Client
| ID | Satisfies | Requirement |
|---|---|---|
| TR-C01 | FR-021..025 | Replace `client/src/sim/tunnel.ts` with a real transport module exposing the same store-facing surface (connect, snapshots, channels), so screens don't change. |
| TR-C02 | FR-100 | Track A transport: open a WebSocket to `wss://<pi-ip>:<port>` after a TLS trust decision; subscribe to telemetry; request history. |
| TR-C03 | FR-101 | Track B transport: Rendezvous signalling → ICE/DataChannel → Noise handshake → multiplexed channels. |
| TR-C04 | FR-002..005 | Real pairing: scan QR → decode connection blob + Agent static key → handshake → compute + display fingerprint → biometric → persist trust record in the Keychain. |
| TR-C05 | FR-045 | Shell channel bytes ↔ a terminal emulator surface; SIGWINCH on resize; reattach logic. |
| TR-C06 | NFR-009 | Keep the "honest data" rules: coverage-gap hatching, staleness stamps, real milestone events. |
| TR-C07 | NFR-010 | Preserve accessibility + design-token discipline already in the client. |

### 3.2 Agent
| ID | Satisfies | Requirement |
|---|---|---|
| TR-A01 | FR-020,022 | A sampler task reads each metric source at its cadence and writes to the store. |
| TR-A02 | FR-021,023 | A telemetry publisher streams snapshots + coverage intervals to subscribers. |
| TR-A03 | FR-040,041 | A shell manager spawns PTYs as **transient systemd units outside the Agent sandbox** (so `sudo`, `/usr`, and CPU quota behave), pipes bytes over the channel, handles resize & reattach. |
| TR-A04 | FR-060..062 | An action runner reads the allow-list from config, executes with metadata, streams progress + exit status. |
| TR-A05 | FR-080..082 | A rules engine evaluates rules per sample, persists alert history, answers backtest queries. |
| TR-A06 | FR-001,006,007 | An identity module: static keypair, trusted-device store, pairing QR, revoke/rotate. |
| TR-A07 | FR-100/101 | A transport module: Track A local TLS server; Track B outbound connection to Rendezvous + Noise session. |
| TR-A08 | NFR-003,005 | Config-driven, low-overhead, crash-resilient; systemd `Restart=on-failure`; state persisted so restart is transparent. |

### 3.3 Rendezvous (Track B)
| ID | Satisfies | Requirement |
|---|---|---|
| TR-R01 | FR-101 | Match a client and an Agent by an opaque rendezvous id; exchange ICE candidates; step aside for the direct path. |
| TR-R02 | FR-101 | Relay opaque encrypted frames when no direct path exists (TURN-like), without decrypting. |
| TR-R03 | FR-083 | Hold the minimum durable state needed to wake a client on an alert (Agent→APNs-token mapping) and nothing more; the permitted-state set is written down and test-enforced. |
| TR-R04 | NFR-006 | Prove by test that a dump of all Rendezvous state contains no readable telemetry, keys, or push content. |

---

## 4. Interfaces (contract summary — full schemas in [07-PROTOCOL-API](07-PROTOCOL-API.md))

- **Local dev API (Track A / MVP):** `GET /snapshot`, `GET /series?key=&from=&to=`,
  `GET /actions`, `POST /actions/:id/run`, `WS /telemetry`, `WS /shell`. TLS,
  bearer-token from pairing.
- **Binary protocol (both tracks):** framed, length-prefixed CBOR messages
  multiplexed into logical **channels**: `control`, `telemetry`, `shell`,
  `actions`, `screen`, `input` (reserved: `files`). Every response states its
  rollup tier / coverage where applicable; errors carry a stable code.
- **Signalling (Track B):** WebSocket JSON to Rendezvous for offer/answer/ICE.

---

## 5. Environments

| Env | Client | Agent | Rendezvous |
|---|---|---|---|
| **Dev** | Expo dev build on simulator/device; Metro bundler. | `cargo run` on a dev Pi or an ARM VM; verbose logs. | `go run` / `cargo run` locally. |
| **Staging** | TestFlight build. | Release binary on a real Pi via the installer; systemd. | Small VPS, staging domain. |
| **Prod** | App Store build. | Release binary; auto-update channel. | Hardened VPS/edge; TLS; monitored. |

Build targets: Agent cross-compiled for `aarch64-unknown-linux-gnu` (glibc);
"one self-contained executable dynamically linked against glibc" — a fully static
musl binary is not a goal because PipeWire (desktop phase) `dlopen`s SPA plugins.

---

## 6. Hard technical constraints (must design around)

| # | Constraint | Consequence |
|---|---|---|
| TC-1 | Pi has no battery-backed RTC | A ±skew handshake check rejects legit connections after a power cut → use a persisted monotonic watermark + refuse pairing until NTP-synced. |
| TC-2 | Wayland socket is mode `0700` in `/run/user/<uid>` | A system daemon can't reach the session → **split design**: a user-session unit for capture/input + a small privileged helper for Actions, over a local socket. |
| TC-3 | Desktop user has `sudo` | The shell channel is effectively remote root → audit log mandatory; shell spawned outside the sandbox; sessions won't appear in `who`/`utmp`. |
| TC-4 | Pi 5 has no HW H.264 encoder | Remote Desktop uses software encode → default 720p low-fps, damage-rects; licence decision (x264 GPL vs OpenH264 BSD). |
| TC-5 | iOS background limits (NSE ~30 s/~24 MB, no WebRTC there) | The WebSocket path is load-bearing for background alert enrichment & widget freshness → ship it before WebRTC. |
| TC-6 | Unordered DataChannel breaks a Noise counter nonce | Use a single reliable-ordered channel with an adaptive record cap. |
| TC-7 | SD-card write endurance | Batch/rollup writes; keep raw retention modest; prefer append + periodic compaction. |

---

## 7. Cross-cutting technical decisions

- **One message layer, two transports.** The channel/message code is transport-agnostic; Track A wraps it in WS/TLS, Track B in a Noise-over-DataChannel session. Adding Track B doesn't rewrite the app.
- **The client never trusts the network for meaning.** Coverage intervals, `producedAt`, rollup tiers, and milestone events come from the Agent so the UI reflects reality.
- **Config over code on the Pi.** Actions, retention, sampling interval, and the metric set are config the owner edits; the Agent reloads without a rebuild.
- **Fail-open on observability, fail-closed on control.** Telemetry degrades gracefully; shell/actions require a live, authenticated, verified session.
