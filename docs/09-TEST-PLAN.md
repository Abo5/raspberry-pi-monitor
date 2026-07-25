# 09 — Test Plan

> Terms per [00-GLOSSARY](00-GLOSSARY.md). Requirements under test are defined in [02-SRS](02-SRS.md) and [01-BRD](01-BRD.md).

| Field | Value |
|---|---|
| Document | 09 — Test Plan |
| Version | 1.0 |
| Date | 2026-07-24 |
| Author | Abo5 |
| Status | Draft |
| Covers | FR-001…FR-912, NFR-001…NFR-055, SEC-001…SEC-036, UC-01…UC-14, BR-01…BR-30 |
| Catalogue size | 216 test cases (TC-001…TC-1314) |

### Revision history

| Version | Date | Author | Change |
|---|---|---|---|
| 1.0 | 2026-07-24 | Abo5 | Initial issue. Strategy, environments, 216-case catalogue, network matrix, security suite, benchmarks, accessibility checklist, release gate. |

---

## 1. Purpose and scope

This plan defines how every requirement in [02-SRS](02-SRS.md) is verified before the v1 release. It is written for a solo developer: automation is prioritised where it pays for itself repeatedly, and manual effort is concentrated in the places automation cannot reach — physical network conditions, real hardware thermals, App Review realities, and human ceremonies like fingerprint verification.

**In scope:** Agent (Rust), Client (iOS), Rendezvous, the wire protocol between them, and the deployed system as a whole.
**Out of scope:** anything listed out of scope in [01-BRD §6.2](01-BRD.md#62-out-of-scope-for-v1--decided-not-deferred-by-accident). A test case that would only pass by implementing an out-of-scope feature is a defect in this plan, not a gap in the product.

---

## 2. Test strategy

### 2.1 Principles

| # | Principle |
|---|---|
| TS-1 | **Every requirement maps to at least one test case, and every test case maps to at least one requirement.** The reverse index in §10 is the authority. |
| TS-2 | **Security and performance are gates, not reports.** A failing SEC or performance threshold blocks release; it is not a known issue. |
| TS-3 | **Test on real hardware for anything touching capture, encode, thermals, or storage endurance.** Emulation lies about exactly the properties that decide this product. |
| TS-4 | **Negative tests are first-class.** For every capability there is a test that it is *refused* when it should be. |
| TS-5 | **Never trust the Client's UI as the enforcement point.** Authorisation tests drive the protocol directly, bypassing the app. |
| TS-6 | **Measure percentiles, not averages.** Latency requirements are written as p50/p95 and must be verified as such over ≥ 300 samples. |
| TS-7 | **Fail loudly on flakiness.** A test that fails intermittently is triaged as a product defect until proven a harness defect. |

### 2.2 Test levels

| Level | Owner | Scope | Automation | Cadence |
|---|---|---|---|---|
| **L1 Unit** | Both codebases | Pure functions: framing, nonce handling, retention eviction, rollup arithmetic, alert predicate evaluation, coordinate mapping, terminal parsing | Full | Every commit |
| **L2 Component** | Agent / Client separately | Sampler against a fake procfs; store against a temp filesystem; encoder pipeline against synthetic frames; Client view models against a mock Tunnel | Full | Every commit |
| **L3 Integration** | Agent ↔ Client, both against a real Rendezvous | Handshake, Channel multiplexing, subscription, backfill, revocation propagation | Full (headless harness) | Every commit on main |
| **L4 End-to-end** | Assembled system, real Pi, real iPhone | UC-01…UC-14 walked through the real UI | Partial (XCUITest for Client flows; manual for ceremonies) | Nightly + pre-release |
| **L5 Security** | Adversarial harness | MITM, replay, downgrade, tampered relay, revoked device, key rotation, fuzzing | Mostly automated | Weekly + pre-release |
| **L6 Performance** | Instrumented rig | Latency, frame rate, CPU, memory, storage, battery | Automated with manual battery runs | Weekly + pre-release |
| **L7 Usability & accessibility** | Manual with real users | Setup time, VoiceOver, Dynamic Type, RTL, error copy | Manual, checklist-driven | Per milestone |
| **L8 Field / soak** | Deployed beta | 30-day soak, real networks, real workloads | Telemetry-assisted, manual triage | Continuous from M5 |

### 2.3 Entry and exit criteria per level

| Level | Entry | Exit |
|---|---|---|
| L1/L2 | Code compiles; coverage instrumentation on | ≥ 80% line coverage in the modules named by NFR-052; 0 failures |
| L3 | L1/L2 green | All L3 cases pass on both Pi 4 and Pi 5 harnesses |
| L4 | L3 green; a build installable on a real device | All UC flows pass, including every listed exception flow |
| L5 | L4 green | 0 High/Critical findings open; every SEC case passes |
| L6 | L4 green; thermal steady state reached | Every threshold in §7 met |
| L7 | Feature-complete UI for the flow under test | Checklist §8 fully passed |
| L8 | Release candidate | 30 days with no Critical, ≤ 2 Major open |

### 2.4 Defect severity

| Severity | Definition | Release impact |
|---|---|---|
| **Critical** | Data loss, key exposure, plaintext leak, authorisation bypass, unrecoverable state, crash on a primary flow | Blocks release unconditionally |
| **Major** | A Must-have requirement not met; a primary flow unusable on a supported configuration; a performance threshold missed | Blocks release |
| **Minor** | A Should-have requirement not met; a workaround exists | Release with a recorded waiver |
| **Cosmetic** | Visual or copy defect with no functional impact | Backlog |

---

## 3. Test environments

### 3.1 Hardware matrix

| ID | Role | Specification | Required for |
|---|---|---|---|
| HW-A | Primary Agent | Raspberry Pi 5, 8 GB, active cooler, NVMe boot, HDMI display attached, labwc on Trixie | All Agent cases; the reference for every NFR figure |
| HW-B | Secondary Agent | Raspberry Pi 5, 4 GB, passive case, A2 SD boot, labwc on Bookworm | Thermal, storage endurance, OS-version matrix, multi-agent |
| HW-C | Legacy Agent | Raspberry Pi 4, 4 GB, SD boot, labwc on Bookworm | NFR-014, NFR-048, degradation behaviour |
| HW-D | Headless Agent | Raspberry Pi 5 with no display and no graphical session | FR-315, headless telemetry and shell |
| HW-E | Primary Client | iPhone with a recent SoC, iOS 17.x then latest | All Client cases; performance reference |
| HW-F | Secondary Client | Older supported iPhone (iOS 17.0 baseline), smaller screen | Multi-device, revocation, layout, battery contrast |
| HW-G | Rendezvous | Small VPS, 2 vCPU, public IPv4 + IPv6, TLS | All connectivity cases |
| HW-H | TURN | Self-hosted coturn, separate host, metered | Relay cases and cost measurement |
| HW-I | Network rig | Router with configurable NAT type, a CGNAT-simulating double-NAT segment, a link emulator for loss/delay/jitter, a captive-portal AP, an IPv6-only segment | Whole network matrix (§6) |
| HW-J | Build/CI | macOS host with Xcode 16; Linux host for Agent CI and cross-compilation | All automated levels |
| HW-K | Power measurement | USB power meter for the Pi; iOS battery instrumentation on HW-E | NFR-029, NFR-030 |

### 3.2 Software environments

| Env | Composition | Purpose |
|---|---|---|
| ENV-DEV | Local Agent build, simulator or device Client, local Rendezvous | Fast iteration; not valid for performance or network results |
| ENV-CI | Headless Agent on a Pi runner + protocol harness; macOS runner for Client unit/UI tests | L1–L3 on every commit |
| ENV-INT | HW-A + HW-E + HW-G + HW-H on the lab network | L3/L4 |
| ENV-NET | ENV-INT routed through HW-I | Network matrix, L5 tampering |
| ENV-PERF | HW-A (or HW-C) instrumented, fixed workload generator, HW-K attached | L6 |
| ENV-FIELD | Beta Owners' own hardware and networks | L8 |

### 3.3 Test data and fixtures

| Fixture | Description |
|---|---|
| FX-1 | Synthetic procfs/sysfs tree replaying a recorded 24-hour metric profile, including a thermal spike, a disk-fill event, and a service failure |
| FX-2 | Deterministic screen content generator: static text page, scrolling text, a moving window, and a full-screen video, each 60 s |
| FX-3 | A 30-day pre-populated Series store at each retention resolution, for chart, backfill, and retention testing |
| FX-4 | A malicious Rendezvous that reorders, duplicates, drops, delays, truncates, and bit-flips blobs on command |
| FX-5 | A MITM proxy able to substitute its own static key and to attempt version/cipher downgrade |
| FX-6 | Keyboard/pointer event corpus covering every modifier combination, dead keys, and Arabic input |
| FX-7 | Localization pseudo-locale (elongated strings) and a full Arabic string catalogue |
| FX-8 | Network condition profiles as machine-readable link-emulator configurations (§6) |

---

## 4. Roles and responsibilities

Solo developer, wearing named hats to keep the boundaries honest.

| Hat | Responsibility |
|---|---|
| Implementer | L1/L2 authored with the code; may not sign off L5 or L6 |
| Test engineer | Owns L3–L6 harnesses and the catalogue in §5; triages defects |
| Security reviewer | Owns L5; the external reviewer signs off SEC before release (OBJ-6) |
| Usability facilitator | Runs L7 sessions with real participants; must not coach |
| Release manager | Enforces §9 gate; the only role permitted to grant a waiver, in writing |

---

## 5. Test case catalogue

Format: **ID · Requirements covered · Precondition · Steps · Expected result.** All cases are pass/fail. Where a case is a benchmark, the threshold is the pass criterion.

### 5.1 TC-0xx — Pairing and identity

| ID | Req | Precondition | Steps | Expected result |
|---|---|---|---|---|
| TC-001 | FR-001, SEC-001, SEC-007 | Fresh Agent install, no key store | Start Agent; inspect key store file and permissions; restart Agent | Key pair generated once; file mode restricted to the service user; not world/group readable; key unchanged across restart; no key bytes in journald |
| TC-002 | FR-002 | Agent running | Run the pairing command; decode the QR payload | Payload contains protocol version, Agent id, Agent static public key, Rendezvous endpoint, single-use token, expiry — and no private key |
| TC-003 | FR-003, SEC-006 | Invitation issued | Complete pairing; attempt to reuse the same token; issue another and wait past expiry then use it | First use succeeds; reuse rejected with "token used"; expired token rejected with "token expired"; both rejections leave no partial record |
| TC-004 | FR-004, SEC-004 | Fresh Client install | Launch app; inspect key storage attributes; attempt export | Device key created in the platform key store, unlock-protected, non-migratory; export impossible; absent from an unencrypted backup |
| TC-005 | FR-005, SEC-005 | Invitation displayed on the Pi | Scan QR; compare fingerprints on both surfaces | Identical fingerprint shown on Agent and Client in both hex and word forms; pairing does not complete until both sides are affirmed |
| TC-006 | FR-005, SEC-005 | As TC-005 | Decline the fingerprint match on the Client | Pairing aborts; no record on either side; a local security event recorded; guidance text names possible attack |
| TC-007 | FR-005 | As TC-005 | Leave the ceremony untouched past the timeout | Both sides abort and discard state; token invalidated |
| TC-008 | FR-006, SEC-002 | Client with no record for an Agent | Attempt connection to an unpaired Agent by any in-app route | No affordance exists to trust the key; connection refused; no "continue anyway" option anywhere in the UI |
| TC-009 | FR-007 | Pairing complete | Inspect the Agent's device record | Record contains device public key, name, model, timestamp, and default capability grants |
| TC-010 | FR-008 | Agent paired | Rename the Agent in the Client; restart the app | Name persists; default was the Agent hostname |
| TC-011 | FR-009 | Agent and Client on the same LAN; Rendezvous stopped | Perform full pairing | Pairing completes with no Rendezvous traffic observed |
| TC-012 | FR-012 | Camera permission denied | Choose manual entry; type the code; then type a corrupted code | Valid code pairs successfully; corrupted code is rejected by the error-detecting encoding, not by a failed handshake |
| TC-013 | FR-002, FR-005, FR-008, NFR-039 | Unopened Pi and phone; written guide only | Time a competent Linux user from install to first live Snapshot | ≤ 10 min median across ≥ 5 participants; ≤ 15 min p90 |
| TC-014 | FR-013 | Device already paired | Re-run the pairing ceremony for the same device | Existing record replaced, not duplicated; device name preserved; count of paired devices unchanged |
| TC-015 | FR-010 | Agent at its paired-device limit | Attempt to pair one more device | Refused with a specific limit reason; Client instructs the Owner to revoke first |
| TC-016 | FR-011 | Client with 16 paired Agents | Add one more | Refused with a clear limit message; existing pairings unaffected |
| TC-017 | FR-810, UC-13 | Agent paired with 2 devices | Rotate the Agent key from the console; attempt connection from each device | Old key refused; each Client shows a re-verification prompt rather than connecting or failing silently; grants preserved after re-verification |
| TC-018 | FR-811, UC-13 | No Client reachable | Issue a console-initiated invitation on an Agent with zero reachable devices | Invitation issued; pairing completes; documentation states the all-devices-plus-no-console case is unrecoverable |

### 5.2 TC-1xx — Connectivity and tunnel

| ID | Req | Precondition | Steps | Expected result |
|---|---|---|---|---|
| TC-101 | FR-101, SEC-020 | Agent running normally | Port-scan the Pi from the LAN and from the internet across TCP and UDP | No inbound listening socket for Tunnel establishment on any non-loopback interface |
| TC-102 | FR-102 | Agent registered with Rendezvous | Kill the Rendezvous connection; restore it; repeat 10 times | Agent re-registers automatically each time with exponential backoff and jitter; no manual action; no tight retry loop |
| TC-103 | FR-103, SEC-015 | Instrumented Rendezvous | Capture everything Rendezvous handles during a full Session | Only opaque blobs and routing metadata; no plaintext; nothing persisted at rest beyond short-TTL routing state |
| TC-104 | FR-104 | Agent registered; nominal load | Issue 300 connect requests; measure signalling delivery latency | ≤ 2 s at p95 |
| TC-105 | FR-105 | Both endpoints behind ordinary NAT | Establish a Session; capture the ICE candidate set | Host, server-reflexive, and relayed candidates gathered; best working pair selected |
| TC-106 | FR-106 | Standard environment | Establish a Session; inspect the transport | WebRTC DataChannel is the transport; the Noise_IK handshake runs inside it |
| TC-107 | FR-107 | Direct paths blocked at the rig | Connect | Falls back to TURN without Owner action; Session usable; UI reports "relayed" |
| TC-108 | FR-108 | TURN blocked as well | Connect | Falls back to WebSocket through Rendezvous; UI reports "relayed via Rendezvous"; encryption unchanged (verified by capture) |
| TC-109 | FR-109, BR-25 | Each path type forced in turn | Read the Client's connection indicator in all four cases; then stop the Agent and separately stop Rendezvous | Correct path class shown for LAN/direct/TURN/Rendezvous; "Pi offline" and "signalling unavailable" are distinct, correctly attributed states |
| TC-110 | FR-110, NFR-012 | Active Session with a shell and telemetry | Switch the phone from Wi-Fi to cellular mid-session; repeat 20 times | Tunnel re-establishes and Channels resume without re-pairing; ≤ 5 s p50, ≤ 12 s p95 |
| TC-111 | FR-111 | Active Session | Sever connectivity for 1 s, 30 s, 5 min, 60 min | Automatic reconnect each time with bounded exponential backoff; immediate retry on foreground or network-available events |
| TC-112 | FR-112, BR-27 | Active Session | Enumerate openable Channels; attempt to open `files` | `control`, `telemetry`, `shell`, `screen`, `input` open; `files` is reserved and refused |
| TC-113 | FR-113 | Remote desktop streaming at full bitrate | Type in the shell and inject pointer input while `screen` saturates the path | Input and shell latency stay within NFR-003 and NFR-004; `screen` yields; no Channel starvation |
| TC-114 | FR-114 | Relayed path forced | Start remote desktop; measure the outbound rate | Bitrate ceiling for relayed paths enforced; Client states the relay limitation |
| TC-115 | FR-115 | Agent and Client on the same LAN | Connect with Rendezvous reachable and again with it stopped | LAN path discovered and preferred; connection succeeds with Rendezvous down |
| TC-116 | FR-111, UC-14 | Session active, telemetry subscribed | Disconnect the network for 30 min; restore | Agent kept sampling throughout; Client reconnects automatically and requests backfill |
| TC-117 | FR-214, UC-14 | As TC-116 | Inspect the restored charts | Missing range backfilled; resolution served is labelled; no fabricated values |
| TC-118 | FR-217, UC-14 | Agent stopped for 20 min while the Client was connected | Restart the Agent; reconnect | Genuine gap is broken in the chart and labelled as an Agent outage via the boot identifier change, not as a network gap |
| TC-119 | UC-14 E-3 | Agent clock deliberately skewed by 90 s | Connect and view charts | Samples keyed to Agent time; the offset is surfaced once it exceeds tolerance |
| TC-120 | NFR-038 | Rendezvous stopped | Operate a LAN-connected Client for 10 min; restart Rendezvous | Full functionality on LAN throughout; automatic recovery within 60 s of Rendezvous returning |

### 5.3 TC-2xx — Telemetry and dashboard

| ID | Req | Precondition | Steps | Expected result |
|---|---|---|---|---|
| TC-201 | FR-201 | Agent running; known CPU load applied | Compare reported aggregate and per-core CPU and load against `top`/`/proc/stat` over 5 min | Within 2 percentage points of the reference at every sample |
| TC-202 | FR-202 | Pi under stress; undervoltage induced on HW-B | Read temperature and throttle flags | Temperature within 1 °C of `vcgencmd`; current and since-boot throttle/undervoltage flags reported separately and correctly |
| TC-203 | FR-203 | Memory pressure applied | Compare reported memory and swap against `/proc/meminfo` | Matches within rounding; cached and available reported distinctly |
| TC-204 | FR-204 | Multiple mounts including USB; I/O generated | Compare capacity, used, inodes, and I/O rates against `df`/`iostat` | All non-virtual mounts present; values match within 2%; virtual filesystems excluded |
| TC-205 | FR-205 | Traffic generated on two interfaces; one interface brought down mid-run | Compare against `/proc/net/dev` | Per-interface counters and derived rates correct; a disappearing interface is handled without error or stale values |
| TC-206 | FR-206 | Agent running | Read reported facts; reboot; read again | Model, OS release, kernel, Agent version, timezone correct; uptime resets; boot identifier changes |
| TC-207 | FR-207 | Watch-list configured with 3 units | Stop one unit; edit the list from the Client | Failed unit reported as failed within one sampling interval; list edit takes effect without an Agent restart |
| TC-208 | FR-208 | CPU and memory hogs running | View top-N processes; change N to 10 | Correct ranking by CPU and by memory; N configurable and honoured |
| TC-209 | FR-209 | Default configuration | Set live rate to 2 s and persisted to 30 s; attempt to set 0.5 s | Rates honoured and measured; sub-1 s rejected |
| TC-210 | FR-213, FR-215, NFR-006 | Session active | Watch the dashboard for 10 min; measure sample-to-render latency over ≥ 300 samples | Tiles for every metric group with sparkline and state colour; ≤ 1.0 s p95 direct, ≤ 2.0 s p95 relayed |
| TC-211 | FR-210 | No Client connected | Run the Agent for 6 h disconnected; then connect | All samples persisted with no gaps attributable to the absence of a Client |
| TC-212 | FR-211 | FX-3 loaded | Inspect the 1-minute, 5-minute, and 1-hour Rollups against the raw data | Min, max, mean, and count correct at each resolution; boundaries aligned |
| TC-213 | FR-212 | FX-3 loaded with data beyond every retention boundary | Run eviction | Data older than each configured boundary removed; nothing within a boundary lost; defaults are 24 h / 7 d / 30 d / 400 d |
| TC-214 | FR-214 | Client cache 24 h stale | Reconnect and observe the backfill | Missing samples served, raw within the raw window and Rollup beyond it, with the resolution labelled |
| TC-215 | FR-216, NFR-007 | Cached history present | Switch across 1 h / 24 h / 7 d / 30 d; pinch-zoom into a sub-range | Correct data at each range; finer resolution requested on zoom; ≤ 300 ms p95 to render from cache |
| TC-216 | FR-217 | A known gap in the data | View the chart across the gap | Line broken, gap shaded, no interpolation, cause labelled where known |
| TC-217 | FR-218 | Detail view open | Read the statistics and scrub the chart | Min, max, mean, p95, and current correct for the visible window; scrub readout follows the touch point |
| TC-218 | FR-215, UC-03 E-1 | HW without a thermal sensor exposed | View the dashboard | Metric shown as unavailable, never as zero |

### 5.4 TC-3xx — Remote desktop

| ID | Req | Precondition | Steps | Expected result |
|---|---|---|---|---|
| TC-301 | FR-301 | HW-A with one display; then a second added | Enumerate outputs in both configurations | Geometry, scale, and refresh reported correctly; hot-plug detected and reported to an active viewer |
| TC-302 | FR-302 | labwc with screencopy; then a portal-only compositor | Start capture on each | Correct mechanism selected and reported; both paths produce frames |
| TC-303 | FR-303 | HW-A | Start capture; inspect the encoder configuration and CPU profile | Software encoder in a low-latency configuration; no dependency on a hardware encoder; runs correctly on Pi 5 |
| TC-304 | FR-304 | ENV-NET, bandwidth stepped down and back up | Stream FX-2 content for 10 min | Bitrate, frame rate, and resolution adapt within 3 s of each change; no stall, no disconnect |
| TC-305 | FR-305 | Session active | Cycle Sharp / Balanced / Smooth and set an explicit resolution | Each preset changes the ceilings as specified; explicit resolution honoured |
| TC-306 | FR-306, NFR-023 | Background load pushing the Pi toward its CPU ceiling | Stream for 10 min while raising background load | Frame rate reduced first, then resolution; CPU ceiling never exceeded in steady state; degradation reason reported to the Client |
| TC-307 | FR-307 | Device A viewing | Request `screen` from device B | Refused or offered as takeover per policy, naming device A; never two concurrent capture streams |
| TC-308 | FR-308 | Capture active | Close the view; measure Agent CPU for 5 min | Capture and encoder resources released within 2 s; no measurable capture/encode CPU with no viewer |
| TC-309 | FR-309, FR-312 | Session active, `input` granted | Inject absolute moves, relative moves, left/right/middle clicks, and scroll using FX-6 | Every event lands at the correct position with correct button semantics; scroll direction correct |
| TC-310 | FR-310 | Session active | Type the full FX-6 corpus including modifier combinations; then kill the Channel mid-chord | All keys and modifiers delivered correctly; on Channel close every held key and button is released — no stuck modifier |
| TC-311 | FR-311 | Remote desktop open | Use Ctrl, Alt, Shift, Super, Esc, Tab, and F1–F12 from the accessory bar | Each key reaches the Pi; sticky-modifier behaviour works as specified |
| TC-312 | FR-313 | Remote desktop open | Zoom, pan, rotate the device, and use a letterboxed aspect ratio; tap precise targets in each state | Coordinate mapping stays correct in every combination; remote resolution unchanged by local zoom |
| TC-313 | FR-314, SEC-032 | Clipboard sync default state | Inspect default; enable one direction; copy in each direction; background the app and retry | Default off; per-direction toggles honoured; no pasteboard read without an Owner-initiated paste; no sync while backgrounded |
| TC-314 | FR-315, UC-05 E-1 | HW-D headless | Open remote desktop | Explicit "no graphical session" explanation and an offer to open the shell; no blank or failed video view |
| TC-315 | FR-316 | Capture starting and stopping | Observe the Pi's display and the audit log | Visible on-Pi indicator throughout capture; audit records at start and stop |
| TC-316 | UC-05 E-2, UC-06 E-1 | Portal permission denied; then `/dev/uinput` permission removed | Attempt capture, then attempt input | Specific failure reasons reported; view-only banner shown when input is unavailable; remediation link present |

### 5.5 TC-4xx — Remote shell

| ID | Req | Precondition | Steps | Expected result |
|---|---|---|---|---|
| TC-401 | FR-401 | Session active, `shell` granted | Open a shell; check the user, shell binary, and working directory | PTY runs as the configured non-root user with the configured shell and directory |
| TC-402 | FR-402 | Shell open | Run `top`, an editor, a pager, and print UTF-8 with combining marks and Arabic text | Rendering matches a reference terminal; 256 colours correct; no mojibake or cursor corruption |
| TC-403 | FR-403 | Shell open with a full-screen app | Rotate the device and change the split | New size applied within 250 ms; SIGWINCH delivered; the app redraws correctly |
| TC-404 | FR-404 | Shell open | Emit 10 000 lines; scroll back; search | ≥ 5 000 lines retained; scrollback smooth; search finds matches |
| TC-405 | FR-405 | Shell open | Use Ctrl-C, Ctrl-D, Esc, Tab completion, arrows, and pipe from the accessory bar | Every key produces the correct control sequence; sticky Ctrl works |
| TC-406 | FR-406 | Shell open | Select and copy output; paste a multi-line block | Copy reaches the iOS pasteboard; multi-line paste is bracketed and not executed line-by-line unintentionally |
| TC-407 | FR-407 | Shell open with a running process | Interrupt the network for 20 s | PTY survives; buffered output delivered on resumption; the process keeps running |
| TC-408 | FR-408 | Session active | Open 3 shells, then a 4th | 3 independent PTYs with independent scrollback; the 4th refused with a limit reason |
| TC-409 | FR-409, SEC-021 | `shell` revoked for this device | Request a PTY through the protocol harness, bypassing the UI | Agent refuses; the UI also hides the entry point, but enforcement is proven at the Agent |
| TC-410 | FR-410 | Shell idle | Wait past the idle timeout | PTY closed; Client states that it closed and why |
| TC-411 | FR-411 | Agent running | Verify no SSH daemon requirement and no listener; stop `sshd` entirely | Shell works with `sshd` stopped and absent; no SSH key material used |
| TC-412 | UC-07 E-4 | Shell with a foreground process | Close the shell | SIGHUP delivered; no orphaned PTY, process group, or file descriptor remains |

### 5.6 TC-5xx — Actions

| ID | Req | Precondition | Steps | Expected result |
|---|---|---|---|---|
| TC-501 | FR-501, FR-502 | Catalogue configured | View the Actions list; inspect what the Agent published | Metadata rendered and grouped; destructive entries visually distinct; the underlying command line is never sent to the Client |
| TC-502 | FR-503, SEC-025 | Session active | Attempt to create, edit, and delete Action definitions through every Channel via the harness | All attempts refused; catalogue changeable only on the Pi |
| TC-503 | FR-504, SEC-025 | Action with an enum parameter | Submit a valid value, an out-of-range value, and a shell metacharacter injection attempt | Valid accepted; others rejected at the Agent and recorded as rejected invocations; no shell interpretation of any parameter |
| TC-504 | FR-506 | Action producing large output | Invoke it | Progress streamed; exit status returned; output tail bounded to the configured size |
| TC-505 | FR-505, SEC-026, BR-12 | Destructive Action; biometric re-auth enabled | Invoke it | Second explicit confirmation required; fresh biometric required; cancelling at either step performs nothing |
| TC-506 | FR-510 | Default installation | Inspect the shipped catalogue | Reboot, shutdown, restart unit, stop unit, vacuum journal, sync, update check present; reboot/shutdown/stop marked destructive |
| TC-507 | FR-509 | Long-running Action started | Cancel it | Whole child process group terminated; cancellation recorded in the audit log |
| TC-508 | FR-508 | Action invoked | Replay the same idempotency key inside and outside the dedup window | Inside: not re-executed, original result returned. Outside: executed normally |
| TC-509 | FR-507, SEC-023 | Several Actions run, including a rejected one | Read the audit log | A record for each, including rejected invocations, with timestamp, identifier, parameters, invoking device, outcome, and exit status |
| TC-510 | UC-08 E-4, A-2 | Reboot Action invoked | Observe the Client through the reboot | "Rebooting" state shown; automatic reconnect when the Agent returns; the result is retrievable from the audit log after reconnect |

### 5.7 TC-6xx — Alerting

| ID | Req | Precondition | Steps | Expected result |
|---|---|---|---|---|
| TC-601 | FR-601 | Session active | Create, edit, disable, re-enable, and delete a rule | All operations persist on the Agent and survive an Agent restart |
| TC-602 | FR-602 | Rule configured; Client disconnected | Breach the threshold with no Client connected | Alert fired and persisted by the Agent; delivered when the Client next connects |
| TC-603 | FR-603 | Rule with a 60 s dwell | Breach for 30 s, then breach for 90 s | No Alert for the short breach; Alert for the sustained one, fired at the dwell boundary |
| TC-604 | FR-604 | Rule with hysteresis | Oscillate the metric between the fire and clear thresholds | No clear until the clear threshold holds for the clear dwell; no rapid fire/clear cycling |
| TC-605 | FR-605, SEC-017, BR-14 | Push path instrumented | Fire alerts of three different types; capture every push payload | No metric name, value, threshold, host name, Agent identifier, or count in any payload; payloads indistinguishable across types |
| TC-606 | FR-606 | Push received, app backgrounded | Observe the wake path | Client resumes the Tunnel, fetches Alert detail over the encrypted Channel, and composes the notification locally with real content |
| TC-607 | FR-607 | ≥ 90 days of Alert history on the Agent | Browse the Alert list | Firing, acknowledged, and resolved states shown; ≥ 90 days retrievable |
| TC-608 | FR-608 | Alert firing; two paired devices | Acknowledge on device A, snooze on device A, mute the rule | State stored on the Agent and reflected on device B without re-pairing |
| TC-609 | FR-609 | Rules at each severity | Fire each | Interruption level matches severity; critical level used only where explicitly marked |
| TC-610 | FR-610 | Flapping metric | Cause 10 fire/clear cycles inside the suppression window | Coalesced into a single Alert with an occurrence count; one notification, not ten |
| TC-611 | FR-612 | Agent powered off | Wait past the missed-contact interval | Client-side reachability Alert raised, visually distinguished from Agent-generated Alerts |
| TC-612 | FR-613, FR-611 | Fresh install | Apply each default template; create a composite AND rule | All templates create working rules; the composite fires only when both conditions hold across the dwell |

### 5.8 TC-7xx — Widgets and Live Activities

| ID | Req | Precondition | Steps | Expected result |
|---|---|---|---|---|
| TC-701 | FR-701 | Paired Agent with cached data | Add small, medium, and large Home Screen widgets | All three render correct current values with correct layout |
| TC-702 | FR-702 | As above | Add circular, rectangular, and inline Lock Screen widgets | All three render legibly within their families |
| TC-703 | FR-703 | Device in StandBy | Observe the widget | Night-appropriate presentation; legible at a distance |
| TC-704 | FR-704 | Widget rendering data of known age | Let the data age past the staleness threshold | Age displayed at all times; values de-emphasised past the threshold |
| TC-705 | FR-705 | Two paired Agents | Configure two widgets for different Agents and different metric slots | Each renders its configured Agent and metrics independently |
| TC-706 | FR-706, NFR-011 | Normal daily use pattern over 7 days | Log widget data age at each observation | Timeline reload requested on every fresher Snapshot; age ≤ 15 min p50 and ≤ 60 min p90 |
| TC-707 | FR-707, SEC-004 | Widget extension running | Inspect the extension's entitlements, container access, and key access | Renders only from the shared container; holds no key material capable of establishing a Tunnel |
| TC-708 | FR-708 | Widgets installed | Tap each distinct region | Deep-links to the correct Agent dashboard or Series detail |
| TC-709 | FR-709 | Fresh install; then all Agents unpaired; then app data erased | Observe the widget in each state | Placeholder, unconfigured, and no-data states rendered explicitly; never zeros or stale values presented as current |
| TC-710 | FR-710, FR-711 | Long-running Action started; Lock Screen redaction enabled | Background the app; lock the device | Live Activity shows elapsed time and status; widget values masked on the Lock Screen while locked |

### 5.9 TC-8xx — Multi-agent and device management

| ID | Req | Precondition | Steps | Expected result |
|---|---|---|---|---|
| TC-801 | FR-801 | Three paired Agents, one offline, one alerting | View the Agent list | Per-Agent state, path class, worst-severity Alert, and last-contact time all correct |
| TC-802 | FR-802 | Two Agents with different history | Switch context repeatedly | Independent dashboards, caches, and settings; no cross-contamination of values |
| TC-803 | FR-803 | One Agent paired with rules and widgets | Pair a second Agent | Existing pairing, history, rules, and widget configuration untouched |
| TC-804 | FR-804 | Two Agents | Set different rules, watch-lists, retention, and grants on each | Settings remain per-Agent; nothing synchronises between them |
| TC-805 | FR-012 duplicate case, UC-11 E-1 | Agent already paired | Scan the same Agent's invitation again | Offered as a replacement of the existing record, not added as a duplicate entry |
| TC-806 | FR-805 | Three devices paired | View the paired-device list | Name, model, pairing date, last-seen, grants shown; the requesting device is identified |
| TC-807 | FR-806, FR-807, SEC-022 | Device B has an active Session with a live shell | Revoke device B from device A | Record deleted; B's Session terminated within 5 s; B's subsequent handshakes refused; B shows an "access revoked" state |
| TC-808 | FR-806 A-2, UC-12 E-1 | Three devices paired | Use "revoke all except this device"; then attempt to revoke the last device | Bulk revocation works; revoking the last device requires an extra confirmation warning about console-only recovery |
| TC-809 | FR-809, SEC-021, BR-28 | Device with all capabilities | Remove `screen` and `actions` mid-Session; then drive the protocol harness directly to use them | Grants take effect on the live Session without reconnection; the harness is refused at the Agent, proving server-side enforcement |
| TC-810 | FR-808, UC-12 E-3 | Agent offline | Rename a device from the console; attempt revocation from a Client with the Agent offline | Rename works on the console; the Client does not present a queued revocation as effective and directs the Owner to the console path |

### 5.10 TC-9xx — Settings, diagnostics, export

| ID | Req | Precondition | Steps | Expected result |
|---|---|---|---|---|
| TC-901 | FR-901, SEC-029 | App installed | Background the app past the re-auth interval; return; fail biometrics; cancel biometrics | Re-authentication demanded; no Owner data rendered until it succeeds; key material stays sealed on failure or cancel |
| TC-902 | FR-902 | Sessions on each path class | Open diagnostics | Connection state, path class, candidate types, RTT, throughput, loss, duration, and reconnect count all shown and accurate |
| TC-903 | FR-903 | Failures injected at each stage in turn | Run the self-test for each | The failing stage is correctly identified and described in plain language |
| TC-904 | FR-904, SEC-023, SEC-024 | Varied audit activity | View, filter, and attempt to delete the audit log through the Tunnel | All event types present and filterable; tamper-evident; deletion through the Tunnel refused |
| TC-905 | FR-905 | History present | Export a Series range as CSV and as JSON | Files match the documented schema; values match the chart; share sheet works |
| TC-906 | FR-906 | Configured Agent | Export the configuration; apply it to a second Agent | Human-readable output; re-application reproduces rules, watch-list, retention, and thresholds |
| TC-907 | FR-907, SEC-031 | Active shell and remote desktop with sensitive content | Generate a diagnostics bundle; inspect every byte | No screen content, shell content, clipboard content, or key material; contents disclosed to the Owner before sharing |
| TC-908 | FR-909 | Session active | Change sampling intervals, retention, watch-list, and top-N from the Client; submit an invalid value | Valid changes applied and persisted; invalid values rejected by the Agent with a clear reason |
| TC-909 | FR-910, NFR-050 | Agent one minor version behind the Client, then one ahead | Connect in both directions | Version and OS shown; update availability indicated without auto-installing; both skews interoperate with explicit notices for unavailable features |
| TC-910 | NFR-049 | Deliberate major protocol mismatch | Connect | Clear actionable version-mismatch error naming which side to update; no silent failure and no downgrade |
| TC-911 | FR-911, BR-26 | Fresh install | Inspect the analytics setting and capture all outbound traffic for 24 h | Analytics off by default; when enabled, no metric values, host names, screen or shell content leave the device |
| TC-912 | FR-912 | Paired Agent with cached data | Run "erase local data" | Cached Series, Snapshots, and pairing records removed; the UI states plainly that the device is not revoked at the Agent |

### 5.11 TC-10xx — Performance and resources

| ID | Req | Precondition | Steps | Expected result (pass threshold) |
|---|---|---|---|---|
| TC-1001 | NFR-001, NFR-002 | ENV-PERF | 300 cold opens and 300 warm opens | Cold ≤ 2.5 s p50 and ≤ 5.0 s p95; warm ≤ 800 ms p95 |
| TC-1002 | NFR-003 | Shell open on each path class | 500 keystrokes per path, measured with a high-frame-rate capture | LAN ≤ 60 ms p95; direct WAN ≤ 150 ms p95; relayed ≤ 250 ms p95 |
| TC-1003 | NFR-004 | Remote desktop at 720p on each path class | 300 input-to-photon measurements per path | LAN ≤ 120 ms p50 / ≤ 180 ms p95; LTE direct ≤ 200 ms p50 / ≤ 320 ms p95; relayed ≤ 450 ms p95 |
| TC-1004 | NFR-005 | HW-A | 100 stream starts | ≤ 1.5 s p50, ≤ 3.0 s p95 to first decoded frame |
| TC-1005 | NFR-013 | HW-A, FX-2 content, 10-minute runs | Measure sustained frame rate at 720p and 1080p | ≥ 25 fps at 1280×720; ≥ 15 fps at 1920×1080 |
| TC-1006 | NFR-014 | HW-C (Pi 4) | Same measurement at 720p | ≥ 15 fps sustained; 1080p not offered as a preset |
| TC-1007 | NFR-015 | Direct and relayed paths | Measure the bitrate envelope at 720p | 0.8–3.0 Mbit/s direct; ≤ 1.5 Mbit/s relayed |
| TC-1008 | NFR-016 | HW-A instrumented | Measure capture-to-encoded-frame over 10 000 frames | ≤ 35 ms p95 at 720p |
| TC-1009 | NFR-017 | Stable path, 10-minute run | Measure inter-frame interval distribution | ≤ 2% of intervals exceed twice the target interval |
| TC-1010 | NFR-018 | Live subscription at defaults | Measure telemetry bandwidth over 1 h | ≤ 12 kbit/s mean, ≤ 40 kbit/s peak |
| TC-1011 | NFR-008 | Phone awake and connected | 50 alert firings, timed from dwell satisfaction to notification presentation | ≤ 60 s p50, ≤ 120 s p95 |
| TC-1012 | NFR-011 | 7-day field observation | Sample widget data age at natural observation moments | ≤ 15 min p50, ≤ 60 min p90 |
| TC-1013 | NFR-021 | HW-A, no Client connected | Measure Agent CPU over 24 h | ≤ 2% of one core mean, ≤ 8% peak |
| TC-1014 | NFR-022 | Live telemetry subscription, no media | Measure Agent CPU over 1 h | ≤ 5% of one core mean |
| TC-1015 | NFR-023 | Remote desktop at 720p target | Measure Agent CPU over 10 min | ≤ 150% mean of 400% total; never above the 200% hard ceiling |
| TC-1016 | NFR-024 | Idle; then `screen` plus 2 PTYs | Measure resident memory in both states | ≤ 60 MiB idle; ≤ 220 MiB active |
| TC-1017 | NFR-025 | HW-B, passive cooling, 30-minute stress | Stream continuously while logging SoC temperature and throttle flags | Encode load reduced before the throttle threshold minus 3 °C; zero Agent-induced throttle events |
| TC-1018 | NFR-029, NFR-030 | HW-E with HW-K instrumentation | 1 h of remote desktop; separately 24 h of background/widget-only operation | ≤ 6% battery per hour active; ≤ 1.5% per day background |
| TC-1019 | NFR-026 | HW-B, default metric set and retention | Run 30 days; measure written bytes and total store size | ≤ 30 MiB/day written; ≤ 500 MiB steady state |
| TC-1020 | NFR-020 | Client 24 h stale | Backfill on a direct path | ≤ 20 s elapsed; ≤ 3 MiB transferred |
| TC-1021 | NFR-033, NFR-034 | HW-A | 30-day soak with periodic Sessions; kill the Agent process 20 times | ≤ 10% memory growth; no FD growth; systemd restarts each time with sampling resumed within 10 s and at most one interval lost |
| TC-1022 | NFR-027, NFR-035 | HW-B | Measure write amplification; then cut power without shutdown, 20 times | ≤ 60 MiB/day to the device; at most 30 s of unflushed data lost; store never corrupted |
| TC-1023 | NFR-032 | HW-G | Simulate 5 000 registered Agents | ≤ 32 KiB memory and ≤ 200 bit/s mean per Agent; service stable |
| TC-1024 | NFR-019, NFR-037 | Direct path | Stream 1 GiB of shell output; run a 7-day Client session soak | ≥ 2 MiB/s with no byte loss and no `input` blocking; crash-free session rate ≥ 99.5% |

### 5.12 TC-11xx — Security

| ID | Req | Precondition | Steps | Expected result |
|---|---|---|---|---|
| TC-1101 | SEC-002, SEC-005 | FX-5 MITM proxy substituting its own static key | Attempt a Session | Client refuses; fingerprint mismatch surfaced; no override path exists; no data flows |
| TC-1102 | SEC-005 | FX-5 during the pairing ceremony | Attempt to interpose during Pairing | Fingerprints differ between the two surfaces; the Owner's comparison detects it; declining aborts with no record written |
| TC-1103 | SEC-003 | Unknown device key | Attempt a handshake from an unpaired device key via the harness | Refused; failure recorded in the audit log; no information leaked about other paired devices |
| TC-1104 | SEC-001, SEC-004, SEC-035 | Both endpoints | Search process memory dumps, disk, logs, backups, and crash reports for key material | No private key, session key, or pairing token found anywhere outside its protected store |
| TC-1105 | SEC-006, SEC-007 | Agent key store permissions widened deliberately | Start the Agent | Agent refuses to start with a clear permissions error |
| TC-1106 | SEC-008 | Full Session with all Channels active | Capture at Rendezvous, at TURN, and on the wire | Only ciphertext observed; no plaintext of any Channel recoverable at any intermediary |
| TC-1107 | SEC-009 | FX-5 offering an older protocol version and weaker parameters | Attempt a downgrade in both directions | Both endpoints refuse; no fallback to unauthenticated or unencrypted mode under any injected error condition |
| TC-1108 | SEC-010 | Two consecutive Sessions | Compromise a static key after the fact and attempt to decrypt recorded traffic | Recorded traffic remains undecryptable; ephemeral keys absent from memory after handshake |
| TC-1109 | SEC-011 | FX-4 malicious Rendezvous | Replay, duplicate, reorder beyond the window, and truncate frames | Every manipulated frame discarded and counted; Session integrity preserved; no state corruption |
| TC-1110 | SEC-012 | Long Session with active `screen`, `shell`, and `input` | Run past every rekey trigger (time, message count, volume) | Rekey occurs at each trigger; no Channel interruption, dropped input, or visible glitch |
| TC-1111 | SEC-013 | FX-4 bit-flipping ciphertext | Inject tag failures below and above the threshold | Frames discarded; Session torn down past the threshold; event recorded in the audit log |
| TC-1112 | SEC-014 | TURN and direct paths blocked | Force the WebSocket-over-Rendezvous fallback and capture | Identical Noise-encrypted payloads; no plaintext, no server-assisted mode, no reduction in guarantees |
| TC-1113 | SEC-017 | Push path instrumented across many Alert types | Capture and compare all payloads | Content-free and mutually indistinguishable; no Owner-derived data |
| TC-1114 | SEC-022 | Revoked device with a live Session | Revoke; then attempt to keep using the Session and to reconnect | Session terminated within 5 s; reconnection refused; revocation does not depend on the revoked device cooperating |
| TC-1115 | SEC-022 | Revoked device with a stale cached catalogue and grants | Drive the harness to invoke every capability | All refused at the Agent regardless of what the device believes it holds |
| TC-1116 | SEC-025 | Session active | Attempt command injection through Action parameters, Channel metadata, device name, and Agent name fields | No injection succeeds; every attempt rejected and audited |
| TC-1117 | SEC-026 | Destructive Action; biometric re-auth enabled; a biometric older than 60 s | Invoke the Action | A fresh biometric is demanded; stale authentication is not accepted |
| TC-1118 | SEC-002, FR-810 | Agent key rotated | Connect from every paired device | Every device refuses to connect silently and demands explicit re-verification of the new fingerprint |
| TC-1119 | SEC-015, SEC-016 | Fully compromised Rendezvous under attacker control (FX-4) | Attempt to read, forge, replay, or inject Channel content; attempt to impersonate either endpoint | Attacker achieves denial of service only; no read, forge, replay, or impersonation is possible |
| TC-1120 | SEC-029, SEC-030 | App with data loaded | Background the app; inspect the app-switcher snapshot; resign active during remote desktop and shell | Content obscured in the switcher; remote-desktop and shell content hidden on resign; re-auth demanded on return |
| TC-1121 | SEC-031, SEC-033 | Sensitive shell and screen content on display | Trigger a crash report; inspect on-device storage and file protection classes | No screen or shell content in crash reports or on disk; cached data protected at first-unlock or stronger |
| TC-1122 | SEC-018 | Passive observer at Rendezvous over 100 Sessions across a week | Attempt long-term correlation of Sessions to one Agent | Correlation limited to what routing unavoidably requires; no stable long-term identifier exposed beyond that |
| TC-1123 | SEC-019, SEC-027, SEC-028 | Deployed Agent | Inspect TURN credential lifetime and scope; inspect the service user, systemd hardening, and `uinput` access grant | Credentials short-lived and scoped; Agent runs non-root with hardening directives; `uinput` access narrowly granted, not via root or a broad group |
| TC-1124 | SEC-034, SEC-036 | Jailbroken test device; and a normal device | Launch on the jailbroken device; inspect the security-state screen on the normal device | Clear warning shown, app still runs; path class, grants, last handshake, and Agent fingerprint all inspectable by the Owner |

### 5.13 TC-12xx — Network condition matrix

Each case runs the same **standard workload**: connect → 5 min live telemetry → open a shell and run an interactive command → 5 min remote desktop at the negotiated quality → invoke a non-destructive Action → disconnect.

| ID | Condition | Req | Expected result |
|---|---|---|---|
| TC-1201 | LAN, both endpoints on the same subnet | FR-115, NFR-010 | LAN path selected; connect ≤ 1.5 s p95; all NFR latency floors met at their LAN values |
| TC-1202 | Home NAT ↔ home NAT, both with public IPv4 | FR-105…FR-107 | Direct path; full workload passes at direct-path thresholds |
| TC-1203 | Good LTE on the Client, home NAT on the Agent | FR-105, NFR-004 | Direct path preferred; LTE latency thresholds met |
| TC-1204 | 5G on the Client, home NAT on the Agent | FR-105 | Direct path; no worse than the LTE case |
| TC-1205 | 300 ms RTT, 5% loss, both directions | FR-304, FR-113 | Session establishes and survives; encoder adapts down; shell remains usable; no disconnect loop |
| TC-1206 | 800 ms RTT, 10% loss (degraded satellite profile) | FR-304 | Telemetry and shell usable; remote desktop degrades to a low frame rate but does not stall or crash |
| TC-1207 | CGNAT on the Client side only | FR-107 | Direct path where the NAT permits, TURN otherwise; workload passes at relayed thresholds |
| TC-1208 | CGNAT on both sides | FR-107 | TURN relay used automatically; workload passes at relayed thresholds; UI reports "relayed" |
| TC-1209 | Symmetric NAT on both sides | FR-107 | TURN relay used; no failure to connect |
| TC-1210 | TURN blocked, direct blocked | FR-108 | WebSocket-over-Rendezvous fallback; workload passes with reduced quality and an explicit notice |
| TC-1211 | Relay forced by configuration | FR-114 | Relayed bitrate ceiling enforced; relay bytes measured for the cost model in [01-BRD §12.3](01-BRD.md#123-relay-cost-sensitivity--the-number-that-matters) |
| TC-1212 | IPv6-only carrier on the Client, dual-stack Agent | CM-7 | Connects successfully; address-family transition handled |
| TC-1213 | MTU restricted to 1 280 bytes | CM-7 | No fragmentation failure or black-holing; workload passes |
| TC-1214 | Mid-session Wi-Fi → cellular handover | FR-110, NFR-012 | Channels resume ≤ 5 s p50 / ≤ 12 s p95; shell survives; remote desktop restarts its stream automatically |
| TC-1215 | Captive portal Wi-Fi (unauthenticated) | FR-109, FR-111 | Failure correctly attributed to the network, not to the Pi; automatic recovery once the portal is satisfied |
| TC-1216 | Rendezvous outage mid-session, then restored | NFR-038, FR-102 | Established Session continues unaffected; new Sessions fail with a correct infrastructure error; automatic recovery within 60 s of restoration |

### 5.14 TC-13xx — Usability, accessibility, and localization

| ID | Req | Precondition | Steps | Expected result |
|---|---|---|---|---|
| TC-1301 | NFR-039, BR-04 | 5 participants matching the personas; written guide only | Time and observe the full setup | ≤ 10 min median, ≤ 15 min p90; ≥ 7 of 8 complete unaided across the beta cohort |
| TC-1302 | UC-01, NFR-046 | Participants unfamiliar with the product | Observe the fingerprint verification step | Participants can articulate why they are comparing; no participant confirms without comparing when prompted to think aloud |
| TC-1303 | NFR-040 | VoiceOver enabled | Walk every primary flow: pair, connect, dashboard, chart, shell, action, alert triage, widget add, revoke | Every interactive element has a meaningful label, value, hint, and trait; every flow completes; chart data reachable as a table alternative via the rotor |
| TC-1304 | NFR-041 | Dynamic Type at xSmall and AX5; Bold Text on | Inspect every screen at both extremes | No clipping, no truncation of essential information, no overlap; Bold Text honoured |
| TC-1305 | NFR-042 | Contrast analyser | Measure every text and meaningful graphic against its background in light and dark appearance | ≥ 4.5:1 body text, ≥ 3:1 large text and meaningful graphics; every state colour accompanied by an icon, label, or shape |
| TC-1306 | NFR-043 | Reduce Motion, Reduce Transparency, Increase Contrast, and haptic-free mode each enabled | Walk the primary flows | Each setting honoured; no animation, transparency, or haptic that the setting should suppress |
| TC-1307 | NFR-044 | Layout inspector | Measure every interactive target including terminal accessory keys and chart scrub handles | All ≥ 44×44 points |
| TC-1308 | NFR-046 | Every error state reachable by injection | Read every error message | Each states what happened, why, and what to do; no raw error code as the primary message; no Owner blame |
| TC-1309 | NFR-045, FR-908 | Arabic system language | Walk every screen | Full RTL mirroring of layout, navigation, and directional icons; chart axes mirrored; terminal content and remote-desktop video **not** mirrored |
| TC-1310 | NFR-045 | FX-7 pseudo-locale and the Arabic catalogue | Sweep all strings including error states, widgets, and notifications | Zero untranslated user-visible strings; correct pluralisation; locale-appropriate numerals and date formats |
| TC-1311 | NFR-045 | Arabic locale, Arabic input via FX-6 | Type Arabic in the shell and into the remote desktop | Characters transmitted and rendered correctly in both directions; bidirectional text handled without corruption |
| TC-1312 | NFR-045 | Arabic locale | Inspect widgets, Live Activities, and notifications | Fully localized and correctly mirrored in every WidgetKit family |
| TC-1313 | UI-1, UI-2 | All connection states forced in turn | Compare app, widget, and notification wording for each state | One consistent state vocabulary across all three surfaces; freshness or age shown wherever data is not live |
| TC-1314 | UI-3, UI-4 | Remote desktop and terminal open with content injected at the screen edges | Attempt to exit each surface; attempt to trigger a destructive affordance with a single gesture | Exit affordance always reachable and never obscured; no destructive action reachable in one gesture |

---

## 6. Network condition test matrix

Every profile is defined as a reproducible link-emulator configuration in FX-8 and is run against the standard workload in §5.13.

| Profile | RTT | Loss | Jitter | Bandwidth | NAT | Applied to | Cases |
|---|---|---|---|---|---|---|---|
| N-1 LAN | < 2 ms | 0% | < 1 ms | ≥ 100 Mbit/s | none | both | TC-1201 |
| N-2 Broadband direct | 20 ms | 0.1% | 3 ms | 50/10 Mbit/s | full-cone both | both | TC-1202 |
| N-3 Good LTE | 45 ms | 0.5% | 15 ms | 20/5 Mbit/s | carrier NAT | Client | TC-1203 |
| N-4 5G | 25 ms | 0.2% | 8 ms | 100/20 Mbit/s | carrier NAT | Client | TC-1204 |
| N-5 Poor mobile | 300 ms | 5% | 60 ms | 3/1 Mbit/s | carrier NAT | Client | TC-1205 |
| N-6 Severe | 800 ms | 10% | 150 ms | 1.5/0.5 Mbit/s | carrier NAT | Client | TC-1206 |
| N-7 CGNAT one side | 60 ms | 0.5% | 10 ms | 20/5 Mbit/s | CGNAT | Client | TC-1207 |
| N-8 CGNAT both sides | 70 ms | 0.5% | 10 ms | 20/5 Mbit/s | CGNAT | both | TC-1208 |
| N-9 Symmetric NAT both | 60 ms | 0.5% | 10 ms | 20/5 Mbit/s | symmetric | both | TC-1209 |
| N-10 Relay-only | 90 ms | 1% | 20 ms | 10/10 Mbit/s | direct blocked | both | TC-1210, TC-1211 |
| N-11 IPv6-only | 40 ms | 0.3% | 10 ms | 50/10 Mbit/s | NAT64/DNS64 | Client | TC-1212 |
| N-12 Low MTU | 40 ms | 0.3% | 10 ms | 20/5 Mbit/s | tunnel MTU 1280 | both | TC-1213 |
| N-13 Handover | varies | varies | varies | varies | Wi-Fi → cellular mid-session | Client | TC-1214 |
| N-14 Captive portal | 40 ms | 0% | 5 ms | gated | portal | Client | TC-1215 |
| N-15 Infra outage | 40 ms | 0% | 5 ms | 50/10 Mbit/s | Rendezvous down then up | infra | TC-1216 |
| N-16 Asymmetric slow uplink | 40 ms | 0.5% | 10 ms | 50/0.7 Mbit/s | full-cone | Agent | TC-1205 variant, run at each milestone |

Pass rule: the standard workload must complete on **every** profile. Latency and frame-rate thresholds apply at the tier appropriate to the path class (direct or relayed); connectivity itself is a hard pass/fail on all sixteen.

---

## 7. Performance benchmarks and thresholds

Benchmarks run on ENV-PERF. Each is executed three times; the median run is recorded and all three must pass. Results are tracked over time so that regressions are visible per milestone.

| Benchmark | Case | Metric | Pass threshold | Fail action |
|---|---|---|---|---|
| B-1 Dashboard open | TC-1001 | Cold / warm open latency | ≤ 2.5 s p50, ≤ 5.0 s p95 / ≤ 800 ms p95 | Blocks release |
| B-2 Shell echo | TC-1002 | Keystroke-to-echo | ≤ 60 / 150 / 250 ms p95 by path class | Blocks release |
| B-3 Input-to-photon | TC-1003 | Touch-to-visible-change | ≤ 180 ms p95 LAN, ≤ 320 ms p95 LTE, ≤ 450 ms p95 relayed | Blocks release |
| B-4 Frame rate Pi 5 | TC-1005 | Sustained fps, 10 min | ≥ 25 fps @ 720p, ≥ 15 fps @ 1080p | Blocks release |
| B-5 Frame rate Pi 4 | TC-1006 | Sustained fps, 10 min | ≥ 15 fps @ 720p | Blocks release or forces the Pi 4 exclusion in OQ-02 |
| B-6 Encoder latency | TC-1008 | Capture-to-encoded frame | ≤ 35 ms p95 @ 720p | Blocks release |
| B-7 Frame stability | TC-1009 | Intervals > 2× target | ≤ 2% | Major defect |
| B-8 Agent CPU idle | TC-1013 | Mean CPU over 24 h | ≤ 2% of one core | Blocks release |
| B-9 Agent CPU streaming | TC-1015 | Mean / peak CPU | ≤ 150% mean, ≤ 200% hard ceiling | Blocks release |
| B-10 Agent memory | TC-1016 | RSS idle / active | ≤ 60 / 220 MiB | Blocks release |
| B-11 Thermal safety | TC-1017 | Agent-induced throttle events | 0 in 30 min stress | Blocks release |
| B-12 Storage growth | TC-1019 | Written per day / 30-day total | ≤ 30 MiB/day, ≤ 500 MiB | Blocks release |
| B-13 Write amplification | TC-1022 | Device writes per day | ≤ 60 MiB/day | Major defect |
| B-14 Client battery | TC-1018 | %/hour active, %/day background | ≤ 6% / ≤ 1.5% | Blocks release |
| B-15 Telemetry bandwidth | TC-1010 | Mean / peak | ≤ 12 / 40 kbit/s | Major defect |
| B-16 Backfill | TC-1020 | 24 h backfill time and bytes | ≤ 20 s, ≤ 3 MiB | Major defect |
| B-17 Reconnect | TC-110 | Handover to Channels resumed | ≤ 5 s p50, ≤ 12 s p95 | Blocks release |
| B-18 Alert latency | TC-1011 | Dwell satisfied to notification | ≤ 60 s p50, ≤ 120 s p95 | Blocks release |
| B-19 Session success | TC-1201…TC-1216 | Success within 10 s across the matrix | ≥ 97% | Blocks release |
| B-20 Soak | TC-1021 | 30-day memory / FD growth | ≤ 10% memory, 0 FD growth | Blocks release |

---

## 8. Accessibility test checklist

Run per milestone on every screen shipped in that milestone; run in full before release. Every item is pass/fail with no partial credit.

| # | Check | Method | Case |
|---|---|---|---|
| A-1 | Every interactive element has a VoiceOver label that describes its purpose, not its appearance | Manual sweep with VoiceOver | TC-1303 |
| A-2 | Every element exposing a value announces it (metric tiles, chart points, toggles) | Manual | TC-1303 |
| A-3 | Traits are correct (button, header, selected, adjustable, updates-frequently) | Manual + Accessibility Inspector | TC-1303 |
| A-4 | Charts expose an equivalent data representation reachable via the rotor | Manual | TC-1303 |
| A-5 | Live-updating values do not interrupt VoiceOver continuously; updates are announced politely | Manual | TC-1303 |
| A-6 | Focus order is logical and follows visual order in both LTR and RTL | Manual | TC-1303, TC-1309 |
| A-7 | Modal presentation traps focus correctly and returns it on dismissal | Manual | TC-1303 |
| A-8 | Dynamic Type xSmall → AX5 with no clipping, truncation, or overlap | Screenshot sweep | TC-1304 |
| A-9 | Bold Text honoured | Manual | TC-1304 |
| A-10 | Contrast ≥ 4.5:1 body, ≥ 3:1 large text and meaningful graphics, in light and dark | Contrast analyser | TC-1305 |
| A-11 | No status conveyed by colour alone — icon, label, or shape always accompanies it | Manual + greyscale screenshot sweep | TC-1305 |
| A-12 | Reduce Motion, Reduce Transparency, Increase Contrast all honoured | Manual | TC-1306 |
| A-13 | Haptic-free mode available and effective | Manual | TC-1306 |
| A-14 | All targets ≥ 44×44 pt including terminal accessory keys and chart handles | Layout inspection | TC-1307 |
| A-15 | Terminal supports the system font-size setting independently of Dynamic Type | Manual | TC-1304 |
| A-16 | Remote desktop offers a pointer mode usable without fine motor precision (trackpad mode with acceleration) | Manual | TC-312 |
| A-17 | Error and empty states are announced and actionable under VoiceOver | Manual | TC-1308 |
| A-18 | Widgets are legible at AX5 and expose accessibility labels | Manual | TC-1304, TC-1312 |
| A-19 | Notifications and Live Activities are fully localized and accessible | Manual | TC-1312 |
| A-20 | No flashing content exceeding three flashes per second | Inspection | Release gate |

---

## 9. Release acceptance gate

A build ships only when **every** row is satisfied. The release manager is the only role permitted to waive a row, only for Minor severity, only in writing, and only with a linked follow-up.

| # | Gate | Criterion | Evidence |
|---|---|---|---|
| G-1 | Requirement coverage | Every FR, NFR, and SEC has ≥ 1 passing mapped test case | §10 reverse index, fully green |
| G-2 | Must-have requirements | 100% of MoSCoW **M** requirements pass | Catalogue results |
| G-3 | Use cases | All UC-01…UC-14 pass including every documented exception flow | L4 run log |
| G-4 | Security suite | TC-1101…TC-1124 all pass; 0 open Critical or High findings; external reviewer sign-off obtained | L5 report + reviewer letter |
| G-5 | Performance | B-1…B-20 all within threshold on the reference hardware | Benchmark record |
| G-6 | Network matrix | Standard workload completes on all 16 profiles; ≥ 97% session success within 10 s | ENV-NET run log |
| G-7 | Hardware matrix | Full L4 pass on HW-A, HW-B, HW-C, and HW-D | Per-device run logs |
| G-8 | Accessibility | A-1…A-20 all pass | Checklist record |
| G-9 | Localization | Zero untranslated strings; zero Major RTL defects | TC-1309…TC-1312 |
| G-10 | Soak | 30 days on HW-A with no Critical and ≤ 2 Major open | Soak log |
| G-11 | Field beta | ≥ 8 Owners, ≥ 14 days, crash-free session rate ≥ 99.5% | Beta report |
| G-12 | Defects | 0 Critical, 0 Major open; every Minor waiver documented | Defect register |
| G-13 | Recovery paths | UC-12 and UC-13 verified on real hardware, including the lost-device and key-rotation flows | L4 run log |
| G-14 | Data honesty | No screen from any surface displays stale data without its age, and no chart interpolates a gap | TC-216, TC-704, TC-1313 |
| G-15 | Compliance | Encryption export declaration filed; no dynamic code-behaviour mechanism present; App Review submission accepted | Submission record |
| G-16 | Documentation | [11-AGENT-DEPLOYMENT](11-AGENT-DEPLOYMENT.md) verified by a participant who has never installed the Agent | Usability record |
| G-17 | Reproducibility | Agent release artefact rebuilds byte-identically and is signed with a published checksum | Build record |
| G-18 | Open questions | Every entry in [02-SRS §9](02-SRS.md#9-open-questions--tbd-register) is resolved or explicitly deferred with an owner | Register review |

---

## 10. Reverse traceability index

| Requirement block | Covering test cases | Coverage |
|---|---|---|
| FR-001…FR-013 (pairing & identity) | TC-001…TC-018, TC-1101…TC-1105, TC-1118 | Complete |
| FR-101…FR-115 (connectivity & tunnel) | TC-101…TC-120, TC-1201…TC-1216 | Complete |
| FR-201…FR-218 (telemetry & dashboard) | TC-201…TC-218, TC-1010, TC-1019, TC-1020 | Complete |
| FR-301…FR-316 (remote desktop) | TC-301…TC-316, TC-1003…TC-1009, TC-1015, TC-1017 | Complete |
| FR-401…FR-411 (remote shell) | TC-401…TC-412, TC-1002, TC-1024 | Complete |
| FR-501…FR-510 (actions) | TC-501…TC-510, TC-1116, TC-1117 | Complete |
| FR-601…FR-613 (alerting) | TC-601…TC-612, TC-1011, TC-1113 | Complete |
| FR-701…FR-711 (widgets) | TC-701…TC-710, TC-1012, TC-1312 | Complete |
| FR-801…FR-811 (multi-agent & devices) | TC-801…TC-810, TC-017, TC-018, TC-1114, TC-1115 | Complete |
| FR-901…FR-912 (settings, diagnostics, export) | TC-901…TC-912, TC-1120, TC-1121 | Complete |
| NFR-001…NFR-012 (latency) | TC-1001…TC-1012, TC-110, TC-215 | Complete |
| NFR-013…NFR-020 (throughput & media) | TC-1005…TC-1010, TC-1020, TC-1024 | Complete |
| NFR-021…NFR-032 (resources) | TC-1013…TC-1019, TC-1022, TC-1023 | Complete |
| NFR-033…NFR-038 (reliability) | TC-1021, TC-1022, TC-1024, TC-116…TC-120, TC-1216 | Complete |
| NFR-039…NFR-046 (usability & accessibility) | TC-013, TC-1301…TC-1314, checklist A-1…A-20 | Complete |
| NFR-047…NFR-055 (maintainability & compliance) | TC-909, TC-910, TC-911, G-15, G-17 | Complete |
| SEC-001…SEC-007 (identity & keys) | TC-001, TC-004, TC-1101…TC-1105, TC-1118 | Complete |
| SEC-008…SEC-014 (session cryptography) | TC-1106…TC-1112 | Complete |
| SEC-015…SEC-020 (infrastructure trust) | TC-101, TC-103, TC-1113, TC-1119, TC-1122, TC-1123 | Complete |
| SEC-021…SEC-028 (authorisation, revocation, audit) | TC-409, TC-509, TC-807, TC-809, TC-904, TC-1114…TC-1117, TC-1123 | Complete |
| SEC-029…SEC-036 (client-side protection) | TC-313, TC-901, TC-907, TC-1120, TC-1121, TC-1124 | Complete |
| UC-01…UC-14 | TC-001…TC-018, TC-101…TC-120, TC-201…TC-218, TC-301…TC-316, TC-401…TC-412, TC-501…TC-510, TC-601…TC-612, TC-701…TC-710, TC-801…TC-810 | Complete |
