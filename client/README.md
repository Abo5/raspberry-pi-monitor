# Pi Monitor — Client (React Native)

React Native (Expo SDK 57 + TypeScript) implementation of the **Client** specified in
[`../docs`](../docs). The original spec targets Swift/SwiftUI; this implementation
transposes it to React Native while keeping the same information architecture, design
system, interaction patterns and normative copy.

## What is implemented

| Area | Status |
|---|---|
| **Bench design system** (docs/13) | Colour tokens (dark-primary + light), type scale (tabular numerals everywhere), spacing/radii/motion — `src/theme/` |
| **Onboarding + pairing ceremony** (docs/07 §3–4) | Welcome → Install → Scan QR (camera) → Fingerprint verification (hex + six words, biometric-gated trust) → Name → Permissions |
| **Dashboard** (§7) | ConnectionBanner with real handshake milestones, liveness dot pulsing per Snapshot, time-range chips, StatTiles + Sparklines, GaugeRing, thermal-tinted temperature, quick actions, active alerts, temperature chart with 80/85 °C thresholds |
| **Metric detail** (§8) | Hero figure, scrubbable chart, stats strip, rules-on-this-metric |
| **Control** (§9–12) | Hub with preconditions, biometric gates, simulated Remote Shell (always-dark TerminalSurface, accessory bar, scrollback never cleared), Actions with literal commands, four-gate destructive confirmation (slide-to-confirm, inert 480 ms), reboot watch state with a real-event rail |
| **Alerts** (§13) | Live rule evaluation with dwell, list (Active/History), detail with ±30 min chart + known causes, rule editor with **backtest preview** ("would have fired N times") |
| **Settings** (§14–16) | Theme, Devices & keys, Diagnostics (tunnel facts, RTT sparkline, channels, security, event log), danger-zone unpair |

## What is simulated

The Rust Agent, Rendezvous service and the Noise/E2EE tunnel are separate milestones
(docs/10 M1+). `src/sim/` stands in for them:

- `metrics.ts` — deterministic smooth generators; history and live Snapshots come from the same function of time, so charts and tiles always agree.
- `tunnel.ts` — connection lifecycle with the four real handshake milestones, RTT jitter, snapshot ticks, rule evaluation, action execution and the reboot offline/return cycle.

Swap point: everything reaches the "Agent" through the store + `sim/tunnel.ts`; a real
transport implements the same surface.

## Run

**Native build (standalone "Raspberry App", no Expo Go):**

```sh
cd client
npm install
npx expo run:ios --device "iPhone 16 Pro Max"   # prebuild → pods → xcodebuild → install
```

This generates the native `ios/` project (git-ignored — regenerated on demand),
builds a real `Raspberry App` and installs it to the simulator. A Debug build
still loads JS from Metro (`npx expo start`); for a fully self-contained app add
`--configuration Release`.

**Expo Go (quicker for JS-only iteration):**

```sh
npx expo start --ios
```

In the simulator (no camera), pair with **"Use a demo Pi (no hardware)"** on the
scan screen, or deep-link `pimon://demo/pair`.

## Tests

```sh
npm test   # jest-expo — 42 unit tests over formatting, fingerprints, the
           # metric generator and store mutations
```

Remote Desktop video (M4) is presented honestly as not-yet-available rather than faked.
