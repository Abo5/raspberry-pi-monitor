# 14 — Open Decisions

Consolidated from independent review by the requirements, architecture/security, and design workstreams. These are the questions where **two documents currently assume different answers**, or where the answer is expensive to change later. Each must be closed before or during **M0** (see [10-ROADMAP](10-ROADMAP.md)).

Nothing here is a defect in the specifications — the specs record the tension deliberately. This page exists so the decision is made once, on purpose, by the Owner.

---

## A. Blocking — decide before writing implementation code

### OD-01 — x264's GPL licence versus this repository's MIT licence
Software H.264 encoding is **mandatory** on the Raspberry Pi 5, which has no hardware H.264 encoder. The obvious encoder, x264, is GPL-2.0. Shipping it inside an MIT-licensed, App Store–distributed binary is a licence conflict, and App Store distribution is independently incompatible with GPL-2.0 terms.

| Option | Consequence |
|---|---|
| Relicense the Agent GPL-2.0, keep Client MIT | Agent stays a separate binary on the Pi; workable, but forecloses a future closed-source Agent. |
| Use OpenH264 (BSD, Cisco-provided binaries) | Licence-clean. Lower quality per bitrate than x264 at the same CPU budget. |
| Isolate x264 in a separate process invoked over IPC | Legally arguable, not clean. Not recommended. |
| Support hardware encode only, i.e. Pi 4 only for Remote Desktop | Contradicts BR scope and the Pi 5 baseline. |

**Recommendation:** OpenH264 for v1, revisit after M4 benchmarks. **Owner decision required — legal, not technical.**
Related: [ADR-0004](adr/ADR-0004-screen-streaming.md), [12-RISK-REGISTER](12-RISK-REGISTER.md).

### OD-02 — Is the Agent a system service or a user service?
Both the requirements and the architecture workstreams reached this independently, from opposite directions. It is the single most consequential unresolved decision.

| Pulls toward **system** service | Pulls toward **user** service |
|---|---|
| Privileged Actions (reboot, service restart, package updates) | Wayland socket at `/run/user/<uid>` is mode `0700` — a system daemon cannot reach it, and loosening it exposes every session secret |
| Survives user logout cleanly | XDG Desktop Portal capture is session-scoped and expects an interactive grant |
| Standard hardening directives apply | `uinput` access and screencopy both live in the session |

A split design — a user-session unit for capture and input, a small privileged helper for Actions, talking over a local socket — resolves it but adds a component, an IPC surface, and a new privilege boundary that the security model must cover.

**Recommendation:** split design, specified and threat-modelled during M0. Affects SEC-027, SEC-028, FR-302, and the whole of [11-AGENT-DEPLOYMENT](11-AGENT-DEPLOYMENT.md).

### OD-03 — How much state may Rendezvous hold?
Rendezvous is specified as stateless and zero-knowledge, yet it must hold a durable Agent → APNs-token mapping to wake the Client on an Alert. That is persistent state and a stable correlatable identifier.

The decision is not *whether* it holds state — it must — but exactly what, for how long, and what an operator who reads the whole database learns. That set must be written down and then verified by test, rather than left as an aspiration.

**Recommendation:** define a minimal permitted-state table in [04-SECURITY-E2EE](04-SECURITY-E2EE.md), enforce it with a test that dumps the Rendezvous store and asserts on its contents.

### OD-04 — The Remote Shell is a full root path
The desktop user has `sudo` on essentially every Raspberry Pi OS install, so the `shell` Channel is unrestricted remote root — not a reduced-privilege convenience. Additionally, a PTY spawned inside a hardened systemd unit inherits that sandbox: `NoNewPrivileges` breaks `sudo`, `ProtectSystem=strict` makes `/usr` read-only inside the user's own shell, and `CPUQuota` throttles their work.

**Consequences that follow automatically:** the audit log is not optional; the shell must be spawned as a transient unit *outside* the Agent's sandbox; and remote sessions will not appear in `who`/`w`/`last` because PAM and `utmp` are bypassed.

---

## B. Should be decided during M0

| ID | Question | Default if undecided |
|---|---|---|
| OD-05 | Is the Raspberry Pi 4 a supported Remote Desktop target? It has a hardware encoder but a much weaker CPU, so it may out-encode the Pi 5. | Yes for telemetry and shell; Remote Desktop marked experimental. |
| OD-06 | Which compositor is normative — labwc, wayfire, or runtime-detected? This decides screencopy versus portal as the primary capture path. | labwc normative, runtime detection with fallback. |
| OD-07 | `zwlr_screencopy_v1` is on a wlroots deprecation path toward `ext-image-copy-capture-v1`, and Trixie ships newer wlroots than Bookworm. | Runtime-probed capture-backend abstraction from day one. |
| OD-08 | The Notification Service Extension (~30 s, ~24 MB) cannot host a WebRTC stack, so the WebSocket path is load-bearing for background alert enrichment and widget freshness — not a last resort. Should it therefore ship first? | Yes — ship the WebSocket transport in M1, WebRTC in M2. |
| OD-09 | The widget and NSE paths run while the user is absent, which weakens the biometric gate. A capability-scoped background key requires Agent-side per-client capability scoping that the baseline does not describe. | Introduce capability-scoped keys in M5, before widgets ship. |
| OD-10 | Objective OBJ-7 targets App Store submission within 9 months; the roadmap runs ~10. | Take the named M4 scope cut, or relax OBJ-7. Decide at M3 exit. |

---

## C. Resolved in the specifications — recorded here for visibility

| Finding | Resolution |
|---|---|
| The Pi has no battery-backed RTC, so a ±120 s handshake skew check rejects legitimate connections after a power cut. | Persisted monotonic watermark plus refuse-pairing-until-NTP-synced. [04-SECURITY-E2EE](04-SECURITY-E2EE.md) §11. |
| Unordered DataChannel delivery is incompatible with the Noise counter nonce. | v1 uses a single reliable-ordered channel with an adaptive record cap bounding head-of-line delay to 1.4–22 ms. |
| "Single static binary" is not achievable — PipeWire `dlopen`s SPA plugins. | Restated as one self-contained executable dynamically linked against glibc. |
| 1080p30 software encode costs 3.0–4.0 cores on a Pi 5. | Default profile is 720p20 (~1.0–1.4 cores); hybrid damage-rect mode is a core feature, not an optimisation. |
| The `files` Channel is named in the Glossary but file transfer is out of v1 scope. | Identifier reserved; opening it is a tested failure (FR-112, TC-112). |
| No mature Swift-native WebRTC stack exists; Google's libwebrtc is awkward under Swift 6 strict concurrency. | Largest unquantified engineering risk. De-risked by OD-08 — ship the WebSocket path first. |
| `hdmi_force_hotplug` is ignored under the default full-KMS driver. | Use the `video=` kernel command line instead. |
| `serde_cbor` is unmaintained. | Use `ciborium` or `minicbor`. |

---

## D. Design decisions that the requirements must mirror

Raised by the design workstream; each implies Agent-side capability that is easy to omit.

| # | Requirement implied |
|---|---|
| 1 | No capability may be reachable *only* through Remote Desktop — it is the least accessible surface in the product. |
| 2 | The Agent must report per-Series **coverage intervals** so the Client can distinguish a transport gap from an Agent gap. Gaps are hatched, never interpolated. |
| 3 | Handshake **milestone events** must be observable, so the connection indicator reflects reality rather than a timer. |
| 4 | Every Series response must state its **Rollup tier**, so a chart can declare its own resolution. |
| 5 | Actions must carry metadata: literal command, expected duration, whether it drops the Tunnel, whether it is destructive, whether it is long-running. |
| 6 | The Agent needs a **backtest query** so the Alert Rule editor can report "this would have fired 3 times in the last 24 h". |
| 7 | Remote Shell sessions must survive a Tunnel drop and be re-attachable for a grace period. Scrollback is never cleared by an error. |
| 8 | No Agent Action is invocable from a widget, notification action, or Live Activity — they deep-link into the confirmation flow instead. |
| 9 | Snapshot must carry `producedAt` (Agent clock) separately from `receivedAt`, plus `staleAfter` and `veryStaleAfter`. The widget staleness contract cannot be built without them. |
| 10 | A device passcode is a hard prerequisite for pairing. Multi-line paste into Remote Shell must be guarded. Quality and bitrate changes must be reported to the user, never silent. |
