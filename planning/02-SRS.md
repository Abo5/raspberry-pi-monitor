# 02 — Software Requirements Specification (SRS)

Numbered, testable requirements for the whole system (Client + Agent +
Rendezvous). Each requirement has an ID for traceability into the
[TRD](03-TRD.md), [test plan](10-IMPLEMENTATION-PLAN.md), and code.

**Legend:** FR = functional, NFR = non-functional. Priority: `M` must (v1),
`S` should, `C` could (later phase). Component: `CLI` client, `AGT` agent,
`RDV` rendezvous.

---

## 1. Actors & use cases

| Actor | Description |
|---|---|
| **Owner** | The person holding the paired iPhone. |
| **Agent** | The daemon on the Pi. |
| **Rendezvous** | The relay/signalling service (Track B). |

| UC | Use case |
|---|---|
| UC-01 | Install the Agent on the Pi. |
| UC-02 | Pair the phone with the Pi (QR + fingerprint verification). |
| UC-03 | View live telemetry on the dashboard. |
| UC-04 | View historical charts for a metric. |
| UC-05 | Open and use an interactive shell. |
| UC-06 | Run an allow-listed Action (incl. a destructive one). |
| UC-07 | Create an alert rule and receive a notification when it fires. |
| UC-08 | Reconnect after a network change without losing Pi-side data. |
| UC-09 | Manage multiple Pis. |
| UC-10 | Add a Home/Lock-Screen widget. |
| UC-11 | View the Pi's remote desktop. |
| UC-12 | Revoke a device / rotate keys / unpair. |

---

## 2. Functional requirements

### 2.1 Pairing & trust
| ID | Pri | Cmp | Requirement |
|---|---|---|---|
| FR-001 | M | AGT | On first run (or on demand) the Agent generates a static keypair and displays a pairing QR containing its public key + connection info. |
| FR-002 | M | CLI | The client scans the QR, performs a key handshake, and derives a shared fingerprint. |
| FR-003 | M | CLI | The client shows the fingerprint as hex **and** a 6-word sequence; the Agent shows the same; the user confirms they match. |
| FR-004 | M | CLI | The trust record is written **only after** biometric confirmation succeeds. |
| FR-005 | M | CLI | A fingerprint mismatch aborts pairing, writes no trust record, and logs a security event. |
| FR-006 | M | AGT | The Agent stores the set of trusted device public keys and rejects any un-trusted key. |
| FR-007 | S | CLI/AGT | The owner can list trusted devices, revoke one, and rotate the phone's key. |
| FR-008 | M | CLI | A device passcode is a hard prerequisite; without it the app refuses to store keys and says so. |

### 2.2 Telemetry
| ID | Pri | Cmp | Requirement |
|---|---|---|---|
| FR-020 | M | AGT | Sample the metric set (§ [08-DATA-MODEL](08-DATA-MODEL.md)) at a configurable interval (1/5/15/60 s, default 5 s). |
| FR-021 | M | AGT | Stream live snapshots to a connected client; each snapshot carries `producedAt` (Agent clock), `receivedAt` is set by the client, plus `staleAfter`/`veryStaleAfter`. |
| FR-022 | M | AGT | Persist samples locally with retention + downsampling; serve historical ranges on request, each response stating its rollup tier. |
| FR-023 | M | AGT | Report per-series **coverage intervals** so the client can distinguish a transport gap from an Agent gap. |
| FR-024 | M | CLI | Render live tiles + sparklines for CPU, SoC temp, memory, disk, network; one temperature chart with the 80/85 °C hardware thresholds. |
| FR-025 | M | CLI | Show cached values immediately on open (age-stamped) and promote them to live as fresh snapshots land; never show a blank screen for held data. |
| FR-026 | M | CLI | Draw gaps as explicit hatched regions; never interpolate across a gap. |
| FR-027 | M | CLI | Provide time ranges 15m/1h/6h/24h/7d/30d that scope all tiles/charts together. |

### 2.3 Remote Shell
| ID | Pri | Cmp | Requirement |
|---|---|---|---|
| FR-040 | M | AGT | Spawn an interactive PTY on request as a transient unit outside the Agent's sandbox; stream bytes bidirectionally over the shell channel. |
| FR-041 | M | AGT | Support window resize (`SIGWINCH`) when the client changes cols×rows. |
| FR-042 | M | AGT | Audit-log every shell session (open/close, source device) — the audit log is not optional. |
| FR-043 | M | CLI | Require biometric re-auth before opening the shell. |
| FR-044 | M | CLI | Keyboard accessory bar with Esc/Tab/Ctrl/Alt/arrows and common combos; guard multi-line paste. |
| FR-045 | M | AGT/CLI | A shell session survives a transport drop and is re-attachable within a configurable grace period; scrollback is never cleared by an error. |

### 2.4 Actions
| ID | Pri | Cmp | Requirement |
|---|---|---|---|
| FR-060 | M | AGT | Execute only operations from a Pi-side allow-list; arbitrary commands are the shell's job, never an Action. |
| FR-061 | M | AGT | Each Action declares metadata: literal command, category, expected duration, destructive?, drops-tunnel?, needs-confirmation?. |
| FR-062 | M | AGT | Report Action progress and final exit status + captured stderr. |
| FR-063 | M | CLI | Show the literal command under each Action; group destructive ones separately. |
| FR-064 | M | CLI | Destructive Actions require the 4-gate pattern: destructive styling → consequence sheet → deliberate gesture (slide/typed name) → biometric, before sending. |
| FR-065 | M | CLI | For Actions that drop the tunnel (reboot/shutdown), show a watch state whose stages advance on **real events only**. |
| FR-066 | M | AGT/CLI | No Action is invocable from a widget, notification, or Live Activity — those deep-link into the confirmation flow. |

### 2.5 Alerts
| ID | Pri | Cmp | Requirement |
|---|---|---|---|
| FR-080 | S | AGT | Evaluate user-defined rules (metric, above/below threshold, dwell, severity) on every sample; fire/resolve with dwell semantics. |
| FR-081 | S | AGT | Persist alert history authoritatively (client cannot delete it). |
| FR-082 | S | AGT | Support a **backtest** query so the rule editor can say "this would have fired N times in the last 24 h". |
| FR-083 | S | RDV | Wake the client via push (APNs); the push payload carries **no content** — the client composes the text locally. |
| FR-084 | S | CLI | Rule editor with a live backtest preview; alerts list (active/history); alert detail with the data behind the fire. |

### 2.6 Connectivity
| ID | Pri | Cmp | Requirement |
|---|---|---|---|
| FR-100 | M | CLI/AGT | **Track A:** connect directly to the Agent over the LAN (TLS). |
| FR-101 | S | ALL | **Track B:** connect from any network with no inbound port on the Pi, via the Rendezvous (direct-when-possible, relay-when-not). |
| FR-102 | S | ALL | Emit observable handshake **milestone events** so the connection indicator reflects reality, not a timer. |
| FR-103 | M | CLI | Distinguish "phone offline" from "Pi offline" everywhere — different colour, icon, and copy. |
| FR-104 | S | AGT | On reconnect, backfill the telemetry gap the client missed. |

### 2.7 Multi-Pi, widgets, desktop
| ID | Pri | Cmp | Requirement |
|---|---|---|---|
| FR-120 | S | CLI | Manage multiple paired Pis; the current Pi is app-global state; switching tears down the previous tunnel. |
| FR-140 | C | CLI/AGT | Home/Lock-Screen widgets with a documented staleness contract; no capability reachable only via a widget. |
| FR-160 | C | AGT/CLI | Remote Desktop: capture the Wayland session, encode, stream; inject pointer/keyboard via `uinput`; quality/bitrate changes reported, never silent. |

---

## 3. Non-functional requirements

| ID | Pri | Category | Requirement |
|---|---|---|---|
| NFR-001 | M | Performance | First live reading ≤ 2 s from app open; cached render immediate. |
| NFR-002 | M | Performance | Shell keystroke round-trip ≤ 150 ms LAN, ≤ ~250 ms relayed. |
| NFR-003 | M | Performance | Agent idle CPU < 2% of one core at 5 s sampling; RSS < 60 MB (excl. active shell/desktop). |
| NFR-004 | M | Reliability | Auto-reconnect with exponential backoff; no Pi-side data loss across drops. |
| NFR-005 | M | Reliability | Agent survives client absence, network loss, and its own restart (state persisted). |
| NFR-006 | M | Security | Track B: no server-side plaintext of telemetry, keys, or push content (test-enforced). |
| NFR-007 | M | Security | All transport encrypted (Track A: TLS; Track B: E2EE Noise session). |
| NFR-008 | M | Security | Destructive/security-sensitive actions require biometric re-auth. |
| NFR-009 | M | Usability | Never display fabricated or interpolated data; gaps/staleness explicit. |
| NFR-010 | M | Usability | Accessibility: Dynamic Type, VoiceOver labels, ≥ 4.5:1 text contrast, no colour-only status. |
| NFR-011 | S | Portability | Agent runs on Pi 4 and Pi 5, Raspberry Pi OS Bookworm & Trixie (64-bit). |
| NFR-012 | M | Maintainability | Client, Agent, Rendezvous each independently buildable & testable; unit tests for core logic. |
| NFR-013 | S | Observability | Agent and client keep structured logs; a diagnostics view surfaces connection facts. |
| NFR-014 | M | Compliance | MIT for client & rendezvous; Agent licence resolved per the H.264 codec decision (see [09-SECURITY](09-SECURITY.md)/OD). |
| NFR-015 | S | Efficiency | Storage growth bounded by retention/downsampling; SD-card write-amplification minimised. |

---

## 4. Traceability (requirement → where realised)

| Area | Client | Agent | Rendezvous |
|---|---|---|---|
| Pairing/trust | FR-002..004,007,008 | FR-001,006,007 | — |
| Telemetry | FR-024..027 | FR-020..023 | — |
| Shell | FR-043..045 | FR-040..042,045 | — |
| Actions | FR-063..066 | FR-060..062,066 | — |
| Alerts | FR-084 | FR-080..082 | FR-083 |
| Connectivity | FR-100,103 | FR-100,104 | FR-101,102 |

Every FR/NFR must map to at least one test case in the plan before its phase is
"done".
