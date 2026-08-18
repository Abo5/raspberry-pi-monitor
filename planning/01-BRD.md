# 01 — Business Requirements Document (BRD)

**Project:** Raspberry App — private, secure remote monitoring & control of a
Raspberry Pi from an iPhone.
**Owner:** Abdullah (Abo5).
**Status:** Approved direction; client built, backend to be implemented.

---

## 1. Problem statement

A Raspberry Pi at home runs useful services (media, Pi-hole, Home Assistant,
scripts, storage). To check on it or fix it you currently have to be on the same
network, SSH from a laptop, or expose it to the internet with port-forwarding —
which is inconvenient, laptop-bound, and a security risk. There is no first-class
way to **glance at the Pi's health and act on it from a phone, safely, from
anywhere**, without handing your data to a third-party cloud.

## 2. Vision

A phone app that pairs once with a small program on the Pi and, from then on,
answers two questions in under half a second — *is my Pi alright, and can I reach
it?* — and lets the owner act: open a terminal, run allow-listed operations,
watch live metrics, get alerted when something is wrong, and (later) see the Pi's
desktop. Only the phone and the Pi hold the keys; no cloud account owns the data.

## 3. Business goals & objectives

| # | Objective | Measure of success |
|---|---|---|
| OBJ-1 | Give the owner real-time visibility of Pi health from the phone. | Live CPU, temperature, memory, disk, network within 2 s of app open. |
| OBJ-2 | Allow safe remote control (shell + allow-listed actions). | Interactive shell round-trip < 150 ms on LAN; destructive actions gated. |
| OBJ-3 | Keep everything private — no third-party can read the data. | Track B: zero server-side plaintext, verified by test. |
| OBJ-4 | Work from anywhere, not just the home network. | Track B: reachable over cellular with no port-forwarding. |
| OBJ-5 | Be trustworthy and honest about state. | Never show fake/interpolated data; gaps and staleness are explicit. |
| OBJ-6 | Ship incrementally with a usable product at each phase. | A working LAN MVP before the full internet-capable system. |

## 4. Scope

### 4.1 In scope (the product)
- **Telemetry**: live + historical metrics (CPU, SoC temperature, memory, swap,
  disk usage & I/O, network throughput, load, uptime, pressure/PSI, throttling).
- **Remote Shell**: an interactive terminal (PTY) on the Pi.
- **Actions**: a Pi-defined allow-list of named operations (restart a service,
  update packages, reboot, shutdown) with confirmation for destructive ones.
- **Alerts**: user-defined rules on metrics; notifications when they fire.
- **Widgets**: Home/Lock-Screen widgets showing key metrics (later phase).
- **Remote Desktop**: view/drive the Pi's graphical session (last phase).
- **Pairing & trust**: QR-code pairing with fingerprint verification.
- **Multi-Pi**: manage several Pis from one app.

### 4.2 Out of scope (v1)
- File transfer/browser (identifier reserved, not implemented).
- Android/Web clients (iOS first).
- A hosted multi-tenant cloud account system (the Pi is the source of truth).
- Managing non-Pi Linux hosts (may work incidentally; not a goal).

### 4.3 Phasing (business view)
1. **LAN MVP** — real telemetry + shell on the same Wi-Fi. (Track A)
2. **Internet + security** — relay, NAT traversal, E2EE, pairing ceremony.
3. **Alerts + widgets** — rules engine, push, Home/Lock-Screen widgets.
4. **Remote Desktop** — screen streaming + input injection.

## 5. Stakeholders

| Stakeholder | Interest |
|---|---|
| **Owner/User (Abdullah)** | Primary user; wants convenience, control, privacy. |
| **Developer(s)** | Build and maintain client, Agent, Rendezvous. |
| **The Pi** | The managed asset; source of truth for data and policy. |
| **(Track B) Relay operator** | Runs the Rendezvous; must learn as little as possible. |

## 6. Success metrics (KPIs)

| KPI | Target |
|---|---|
| Time from app open to first live reading | ≤ 2 s (cached values shown immediately). |
| Shell keystroke latency | ≤ 150 ms LAN; ≤ ~250 ms relayed. |
| Telemetry sampling interval | Configurable 1/5/15/60 s; default 5 s. |
| Data privacy (Track B) | 0 bytes of readable telemetry/keys on the relay (test-enforced). |
| Reconnect after network drop | Auto-reconnect with backfill; no data loss on the Pi. |
| Crash-free sessions | ≥ 99.5% (client). |

## 7. Assumptions

- The owner has physical/SSH access to the Pi to run the one-line installer once.
- The Pi has internet access (for Track B) and NTP-synced time.
- A device passcode/biometric is set on the phone (hard requirement to store keys).
- The Pi runs 64-bit Raspberry Pi OS (Bookworm or Trixie).

## 8. Constraints

- iOS background execution limits shape the alerts/widgets design.
- The Pi 5 has no hardware H.264 encoder → software encode for Remote Desktop.
- Keep the Agent lightweight (a home Pi also runs other services).
- No reliance on a paid third-party cloud for core function.

## 9. Risks (summary — full register in the plan)

| Risk | Impact | Mitigation |
|---|---|---|
| NAT traversal fails on some networks (Track B) | Can't connect from outside | Relay fallback (TURN-like) built into Rendezvous. |
| Software H.264 too heavy on Pi 5 | Remote Desktop laggy | Default 720p low-fps; damage-rects; it's the last phase. |
| iOS background limits break alerts/widgets | Missed alerts | Push via APNs + short NSE enrichment; documented staleness. |
| Security bug exposes the Pi | Severe | E2EE, allow-list actions, audited shell, hardening (see [09-SECURITY](09-SECURITY.md)). |
| Scope creep | Slips delivery | Strict phasing; LAN MVP first. |

## 10. Definition of business success

The owner can, from their iPhone: (1) glance and instantly know the home Pi is
healthy and reachable; (2) open a real shell and fix something; (3) get told when
the Pi overheats or a disk fills; (4) do all of it privately, from anywhere — and
trust that the numbers on screen are true.
