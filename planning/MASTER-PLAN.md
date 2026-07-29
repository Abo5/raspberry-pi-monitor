# Master Plan — Raspberry App, from zero to shipped

The single, complete, sequential plan for the whole project: everything already
built, and every remaining step to a finished, released product. Clear enough to
follow top-to-bottom with no gaps.

- ✅ = done and verified · 🟡 = partially done · ⬜ = not started
- Each phase lists: **goal → prerequisites → tasks → how to verify → done when**.
- Deeper detail lives in the sibling docs ([BRD](01-BRD.md), [SRS](02-SRS.md),
  [TRD](03-TRD.md), [Architecture](04-ARCHITECTURE.md), [Agent](05-AGENT.md),
  [Rendezvous](06-RENDEZVOUS.md), [Protocol](07-PROTOCOL-API.md),
  [Data model](08-DATA-MODEL.md), [Security](09-SECURITY.md)).

---

## 0. The product in one line

An iPhone app that pairs once with a small daemon on your Raspberry Pi and then
lets you — privately, from anywhere — see its health, open a shell, run safe
actions, get alerts, and view its screen. Only the phone and the Pi hold the keys.

Three components: **Client** (iOS/React Native), **Agent** (Rust, on the Pi),
**Rendezvous** (relay, for internet access).

---

## 1. Status snapshot (today)

| Area | State |
|---|---|
| Product design & docs (BRD/SRS/TRD/architecture/security/data) | ✅ Written in `planning/` + `docs/` |
| Client app — all screens, navigation, Windows-App visual style, royal-purple theme | ✅ Built (`client/`) |
| Client — RDP-style connect flow (sign-in, save credentials, remote session) | ✅ Built |
| Client — widgets gallery (35 designs), alerts, rule editor w/ backtest, diagnostics | ✅ Built |
| Client — unit tests | ✅ 65 Jest tests green |
| Client — native standalone build (not Expo Go) | ✅ Builds & runs on the iOS Simulator |
| Agent — Rust daemon: sampler + local HTTP/WS API + PTY shell + bearer auth | ✅ Phase-1 built, compiles, runs |
| Client ↔ Agent real transport | ✅ Built + **verified end-to-end** (facts, telemetry stream, shell echo) |
| Real telemetry on a physical Pi | 🟡 Code ready; not yet run on your Pi (need model/OS + a build to the device) |
| History storage, real actions, real alerts on the Agent | ⬜ Phase 2 |
| Internet access + end-to-end encryption + Rendezvous | ⬜ Phase 3 |
| Push notifications + Home/Lock widgets (real) | ⬜ Phase 4 |
| Remote desktop (real screen streaming) | ⬜ Phase 5 |
| Hardening, security review, App Store release | ⬜ Phase 6 |

**Net:** the whole app and a working Agent exist and talk to each other; what
remains is running it on your real Pi and then adding storage, internet,
notifications, the real desktop, and release.

---

## 2. Prerequisites (one-time setup)

⬜ **P-1 Hardware/OS confirmed** — tell us: Pi model (4 or 5), OS (Bookworm/
Trixie), and whether the metric store should live on the SD card or an attached
SSD. *(Only affects Phase 5 desktop encoder + storage location; Phases 1–2 work
on any of them.)*
✅ **P-2 Dev machine** — macOS with Xcode, Node, Rust (`rustup`, installed),
CocoaPods. All present.
⬜ **P-3 Apple Developer account** — needed only for on-device install (Phase 1
on real iPhone) and App Store (Phase 6). Free account is enough to run on your
own iPhone.
⬜ **P-4 A small VPS** — needed only for Phase 3 (Rendezvous). Not before.

---

## 3. The phases

### Phase 0 — Foundations ✅ DONE
**Goal:** repo, tooling, design, and a runnable client shell.
- ✅ Monorepo: `client/`, `agent/`, `planning/`, `docs/`.
- ✅ Client scaffolded (Expo SDK 57 + TS), design tokens, navigation, component library.
- ✅ Simulated data layer so the UI is fully explorable.
- ✅ Jest + CI-able tests; native build path (`expo run:ios`).
**Verify:** app runs on the simulator; `npm test` green. **Done.** ✅

### Phase 1 — LAN MVP: real telemetry + shell ✅ (code complete & verified; awaiting your Pi to run on hardware)
**Goal:** the app shows your Pi's *real* numbers and opens a *real* shell, on the
same Wi-Fi.
**Prereq:** P-1 (Pi reachable on the LAN).
- ✅ Agent sampler (temp, CPU, memory, disk, network, load, uptime) from `/proc`+`/sys`.
- ✅ Agent local HTTP/WS API: `/health /agent /snapshot /series /actions`, `WS /telemetry`, `WS /shell`, bearer-token auth, prints a pairing QR.
- ✅ Client real transport (`localTransport`) + real/sim controller (`transport.ts`).
- ✅ "Connect to a Pi on my network" (manual ip/port/token or scan the Agent QR) → verify → pair → connect.
- ✅ Shell screen drives the **real** PTY over `WS /shell` when the Agent is real (ANSI-stripped renderer); demo stays simulated.
- ✅ Chart history reads the **real** `/series` (via `useSeriesHistory`) when connected to a real Agent; demo stays simulated.
- ✅ Agent build guide + one-line `install.sh` (systemd user service) for **Pi 5 / Raspberry Pi OS 64-bit**.
- ✅ `app.json` NSAllowsLocalNetworking so the native build reaches the LAN Agent.
- ✅ Verified end-to-end against the live Agent: facts, telemetry stream, shell echo, and `/series` history all confirmed over the wire.
- ⬜ **On your hardware:** copy `agent/` to the Pi → `./install.sh` → in the app "Connect to a Pi on my network" with the printed ip/port/token. (Only step left; needs the physical Pi + an on-device app build `npx expo run:ios --device "<iPhone>"` if you want it on a real phone rather than the simulator.)
**Verify:** open the app → tap your Pi → sign in → see live temperature/CPU that
change when you load the Pi; open the shell and run `htop`/`vcgencmd measure_temp`.
**Done when:** real metrics + a working shell from the phone on the LAN. — *All
code done & verified; run `agent/install.sh` on your Pi 5 to light it up.*

### Phase 2 — Storage, actions, alerts ⬜
**Goal:** real history charts, run allow-listed actions, alerts fire on the Pi.
**Prereq:** Phase 1 running on the Pi.
- ⬜ Agent: persistent time-series store (SQLite) + retention + downsampling + coverage intervals (see [Data model](08-DATA-MODEL.md)); real `/series`.
- ⬜ Agent: action runner + a minimal privileged helper; `agent.toml` allow-list (restart a service, apt upgrade, reboot, shutdown) with metadata.
- ⬜ Agent: rules engine (port the client's dwell/fire/resolve logic) + persisted alert history + backtest query.
- ⬜ Client: point actions/rules/alerts and chart history at the real endpoints; drop those simulations.
**Verify:** charts show real multi-hour history; running "Restart Pi-hole" actually restarts it; a temperature rule fires and resolves.
**Done when:** history, actions, and alerts are all real on the Pi.

### Phase 3 — Internet + end-to-end encryption ⬜
**Goal:** reach the Pi from anywhere (cellular), no port-forwarding, fully E2EE.
**Prereq:** P-4 (a VPS); Phase 2.
- ⬜ Build the **Rendezvous** service (signalling + relay + push table) — [spec](06-RENDEZVOUS.md).
- ⬜ Agent + client: outbound connection to Rendezvous; ICE; WebRTC DataChannel; **Noise IK** session over it; relay fallback.
- ⬜ Real pairing ceremony: QR → handshake → fingerprint (hex + 6 words) → biometric → trust record (replaces the LAN token).
- ⬜ Security tests: MITM-at-pairing aborts; un-trusted key rejected; a dump of the Rendezvous store has **no** plaintext (RDV-4).
**Verify:** turn off Wi-Fi, connect over cellular; deliberately mismatch the fingerprint and confirm it aborts.
**Done when:** connect from any network, E2EE, no inbound port on the Pi.

### Phase 4 — Notifications + widgets ⬜
**Goal:** get told when something's wrong even when the app is closed; Home/Lock widgets.
**Prereq:** Phase 3 (Rendezvous can push).
- ⬜ APNs empty-wake via Rendezvous; a Notification Service Extension composes the alert text **locally** (payload carries no content).
- ⬜ Native WidgetKit extension (added to `client/ios`) rendering the chosen widget designs with a documented staleness contract.
**Verify:** trigger an alert with the app closed → phone shows a locally-composed notification; add a widget → it shows fresh-with-age data.
**Done when:** background alerts + at least one working Home and Lock widget.

### Phase 5 — Remote desktop ⬜
**Goal:** see and drive the Pi's actual screen.
**Prereq:** P-1 (Pi model — encoder choice); Phase 3.
- ⬜ Agent: screen capture (screencopy/portal), H.264 software encode (codec/licence decided — likely OpenH264), the `screen` channel; a user-session capture unit.
- ⬜ Agent: input injection via `uinput`; the `input` channel.
- ⬜ Client: replace the simulated remote-desktop view with the real video; gesture→input mapping; quality/bitrate controls (changes reported, never silent).
**Verify:** the Pi's desktop streams and responds to taps; changing quality shows a notice.
**Done when:** real, drivable remote desktop (default 720p, adaptive).

### Phase 6 — Hardening, review, release ⬜
**Goal:** shippable, safe, on the App Store.
**Prereq:** Phases 1–5 (or the agreed release scope).
- ⬜ systemd hardening on the Agent; signed auto-update channel; restrictive key/config perms.
- ⬜ Full security review against [Security](09-SECURITY.md); external review before release.
- ⬜ Accessibility + performance passes; multi-Pi polish.
- ⬜ App Store assets, privacy nutrition labels, TestFlight beta, submission.
- ⬜ Rendezvous prod hosting: TLS, monitoring, rate limits.
**Verify:** clean security review; TestFlight build passes on real devices; App Review approves.
**Done when:** released.

---

## 4. Cross-cutting workstreams (run throughout)

- ⬜ **Testing:** keep client Jest green; add Agent `cargo test` (sampler parsing, rules, store); an integration test per phase mapping each `FR`/`NFR` in scope to a passing check (see [SRS](02-SRS.md) §4).
- ⬜ **CI:** GitHub Actions — client typecheck+test, Agent `cargo check`+`clippy`+cross-compile for `aarch64`, Rendezvous build. Block merge on red.
- ⬜ **Observability:** structured logs (client + Agent); the Diagnostics screen stays truthful (real milestones, RTT, channels).
- ⬜ **Docs:** update `planning/` at each phase exit; keep the READMEs current.
- ⬜ **Honesty invariants (never regress):** no fabricated/interpolated data; gaps & staleness shown; destructive actions gated; the two "offline"s (phone vs Pi) never share a colour/word.

---

## 5. Definition of done (whole project)

From an iPhone, privately and from anywhere, the owner can: glance and know the
Pi is healthy and reachable; open a real shell and fix something; run safe
actions with the right confirmations; be alerted when the Pi overheats or a disk
fills; see the Pi's desktop; and trust that every number on screen is true —
with the app shipped on the App Store and the Agent installable in one line.

---

## 6. Command reference

```sh
# Client
cd client
npm install
npx expo run:ios --device "iPhone 16 Pro Max"   # native build (no Expo Go)
npx expo start --ios                              # JS-only iteration
npm test                                          # 65 Jest tests

# Agent (on the Pi, or a host for a smoke test)
cd agent
source "$HOME/.cargo/env"
cargo run                                         # prints pairing QR; serves the API
cargo check                                       # type-check

# Connect the app to a real Agent
#  App → (add) → "Connect to a Pi on my network" → enter ip / port / token
#  (the Agent prints these on start), or scan its QR.
```

## 7. Immediate next actions (in order)

1. ⬜ You: confirm Pi model + OS (unblocks pinning the Agent build & storage).
2. ⬜ Build/run the Agent on your Pi; connect the app over Wi-Fi (finish Phase 1 on real hardware).
3. ⬜ Swap the Shell screen + chart history to the real channels when on a real Agent.
4. ⬜ Start Phase 2 (SQLite store → actions → rules).
