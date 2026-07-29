# Raspberry App — Project Planning & Design

**Status: planning baseline for implementation.** This folder is the single,
current source of truth for *what* we are building, *why*, and *how*, written so
an engineer (or a fleet of agents) can start building the real system without
guessing.

It supersedes and consolidates the older aspirational spec in [`../docs`](../docs)
where the two disagree; `../docs` remains useful for deep design rationale
(threat model, wire framing, design tokens) and is referenced from here.

---

## 1. What exists today vs. what this plan builds

| Component | Role | Today | This plan |
|---|---|---|---|
| **Client** (iOS app "Raspberry App") | The phone UI | ✅ Built in React Native / Expo (`../client`). All telemetry is **simulated** in-app (`client/src/sim/`). Windows-App visual style, royal-purple accent, 15 screens, 65 unit tests. | Swap the simulation for a **real transport** to the Agent. |
| **Agent** | Daemon on the Pi that reads real metrics, runs the shell, executes Actions | ❌ Not built (spec only) | **Build it** (Rust) — this is the core new work. |
| **Rendezvous** | Zero-knowledge relay so the phone reaches the Pi from any network | ❌ Not built (spec only) | **Build it** (Go or Rust), or skip it for the local-network MVP. |

## 2. The two delivery tracks

- **Track A — Local MVP (fastest to something real).** Phone and Pi on the same
  Wi-Fi. Minimal Agent, no relay, TLS-only. Gets you real temperature, CPU, and
  an interactive shell in days, not weeks. See [11-LOCAL-MVP](11-LOCAL-MVP.md).
- **Track B — Full product (from anywhere).** Adds the Rendezvous relay, NAT
  traversal, end-to-end encryption, alerts push, and widgets. See
  [10-IMPLEMENTATION-PLAN](10-IMPLEMENTATION-PLAN.md).

Track A is Phase 1 of Track B — nothing is thrown away.

## 3. Document index — read in this order

| # | Document | Purpose |
|---|---|---|
| ★ | **[MASTER-PLAN](MASTER-PLAN.md)** | **The complete plan from zero to shipped — start here.** Every phase, task, and done-criteria, with what's already built marked ✅. |
| 00 | **This index** | Orientation, current status, tracks. |
| 01 | [BRD](01-BRD.md) | Business Requirements: problem, goals, users, scope, success metrics. |
| 02 | [SRS](02-SRS.md) | Software Requirements: numbered functional (FR) + non-functional (NFR) requirements, use cases. |
| 03 | [TRD](03-TRD.md) | Technical Requirements: stack, components, interfaces, constraints, environments (TR-). |
| 04 | [System Architecture](04-ARCHITECTURE.md) | The three components, data flow, deployment topology, technology choices. |
| 05 | [Agent Specification](05-AGENT.md) | The Rust daemon on the Pi: modules, metric sources, shell, actions, config, packaging. |
| 06 | [Rendezvous Specification](06-RENDEZVOUS.md) | The relay/signalling server: responsibilities, permitted state, APIs. |
| 07 | [Protocol & API](07-PROTOCOL-API.md) | Wire protocol, channels, message schemas, error codes, the local HTTP/WS API. |
| 08 | [Data Model](08-DATA-MODEL.md) | Metric series, storage, retention, downsampling, client cache. |
| 09 | [Security Design](09-SECURITY.md) | Threat model, key hierarchy, pairing ceremony, transport crypto, hardening. |
| 10 | [Implementation Plan](10-IMPLEMENTATION-PLAN.md) | Phases, milestones, work breakdown, definition of done, risks. |
| 11 | [Local MVP Guide](11-LOCAL-MVP.md) | The concrete fastest path: build a minimal Agent + wire the client to it on your LAN. |

## 4. Target hardware & software baseline

| Side | Baseline |
|---|---|
| Phone | iPhone, iOS 17+. React Native (Expo SDK 57), TypeScript. Built on macOS. |
| Pi | Raspberry Pi 4 or 5, 64-bit Raspberry Pi OS Bookworm/Trixie. Agent = one Rust binary + a systemd unit. |
| Rendezvous | Any small VPS/edge runtime. Stateless-ish. Go or Rust. (Track B only.) |

> **Open item — confirm your hardware.** This plan supports Pi 4 and Pi 5. The
> Pi 5 has no hardware H.264 encoder (affects Remote Desktop only, a later
> phase); telemetry and shell are identical on both. Tell us the exact model
> and OS so the Agent's build targets and metric sources are pinned.

## 5. Non-negotiable principles (carried from `../docs`)

| # | Principle |
|---|---|
| P1 | End-to-end encrypted on Track B — no server-side plaintext, ever. |
| P2 | No inbound ports on the Pi in the final product; connections are outbound-initiated. (Track A's LAN MVP is the one deliberate, documented exception.) |
| P3 | Explicit trust — a device is trusted only after out-of-band pairing with a verified key fingerprint. |
| P4 | The Pi is the source of truth — history and config live on the Pi, not a cloud account. |
| P5 | Degrade, never fail closed on observability — the Agent keeps recording locally and backfills on reconnect. |
