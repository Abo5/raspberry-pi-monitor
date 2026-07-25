# raspberry-pi-monitor

**Specification-only repository.** No implementation code — this repo defines *what* to build and *why*, so that implementation can begin cleanly on macOS/Xcode.

An end-to-end encrypted iOS application for remote control, remote GUI access, shell access, and continuous telemetry of a Raspberry Pi, from anywhere on the internet.

---

## 1. Product in one paragraph

A Raspberry Pi runs a small always-on daemon (the **Agent**). An iPhone app (the **Client**) pairs with that Agent once, over a QR code, and from then on can reach it from any network on earth. The two endpoints hold the only keys: a zero-knowledge **Rendezvous** service helps them find each other and relays bytes when direct connection is impossible, but it can never read, replay, or forge a single byte of the session. Through that tunnel the user gets a live remote desktop, an interactive terminal, a metrics dashboard, historical charts, alerting, and Home Screen / Lock Screen widgets.

## 2. Non-negotiable principles

| # | Principle |
|---|---|
| P1 | **End-to-end encrypted, always.** No server-side plaintext at any point, including push notification payloads and TURN relaying. |
| P2 | **No inbound ports.** The Agent never listens on a public port. All connections are outbound-initiated from both sides. |
| P3 | **Explicit trust.** A device is only trusted after an out-of-band pairing with a verifiable key fingerprint. |
| P4 | **The Pi is the source of truth.** History, config, and policy live on the Pi, not in a cloud account. |
| P5 | **Degrade, never fail closed on observability.** If the tunnel drops, the Agent keeps recording locally and backfills on reconnect. |

## 3. Document index

Read in this order.

| # | Document | Purpose |
|---|---|---|
| 00 | [Glossary](docs/00-GLOSSARY.md) | Shared vocabulary. Read first — every other doc assumes it. |
| 01 | [BRD](docs/01-BRD.md) | Business Requirements: problem, goals, scope, success metrics, stakeholders. |
| 02 | [SRS](docs/02-SRS.md) | Software Requirements Specification: numbered functional + non-functional requirements, use cases, traceability. |
| 03 | [Architecture](docs/03-ARCHITECTURE.md) | Components, deployment topology, technology selection, data flow. |
| 04 | [Security & E2EE Design](docs/04-SECURITY-E2EE.md) | Threat model, key hierarchy, pairing, cryptographic construction. |
| 05 | [Wire Protocol](docs/05-PROTOCOL.md) | Framing, channel multiplexing, message schemas, error codes. |
| 06 | [Data Model](docs/06-DATA-MODEL.md) | Agent-side schema, retention, downsampling, client cache. |
| 07 | [UX Specification](docs/07-UX-SPEC.md) | Screen-by-screen definition, navigation, states, accessibility. |
| 08 | [Widgets & Live Activities](docs/08-WIDGETS.md) | WidgetKit families, timeline strategy, data path. |
| 09 | [Test Plan](docs/09-TEST-PLAN.md) | Test strategy, environments, acceptance criteria per requirement. |
| 10 | [Roadmap](docs/10-ROADMAP.md) | Phased delivery, milestones, definition of done. |
| 11 | [Agent Deployment](docs/11-AGENT-DEPLOYMENT.md) | Installing, hardening, and operating the Agent on the Pi. |
| 12 | [Risk Register](docs/12-RISK-REGISTER.md) | Technical, security, and delivery risks with mitigations. |
| 13 | [Design System](docs/13-DESIGN-SYSTEM.md) | Color tokens, typography, spacing, components, motion, data-viz and accessibility foundations. |
| 14 | [Open Decisions](docs/14-OPEN-DECISIONS.md) | **Read before writing code.** Cross-cutting questions that must be closed in M0. |
| — | [ADRs](docs/adr/) | Architecture Decision Records — the reasoning behind each irreversible choice. |

## 4. Target platform baseline

| Side | Baseline |
|---|---|
| Client | iOS 17.0+, iPhone. Swift 6, SwiftUI, WidgetKit. Built on macOS with Xcode 16+. |
| Agent | Raspberry Pi 4 / 5, 64-bit Raspberry Pi OS Bookworm or Trixie, Wayland (labwc/wayfire) session. Rust, single static binary + systemd unit. |
| Rendezvous | Any small VPS or edge runtime. Stateless. Rust or Go. |

## 5. Status

| Phase | State |
|---|---|
| Requirements & design | ✅ This repository |
| Agent implementation | ⬜ Not started |
| iOS implementation | ⬜ Not started |
| Rendezvous implementation | ⬜ Not started |

## 6. License

MIT — see [LICENSE](LICENSE).
