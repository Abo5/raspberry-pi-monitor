# 13 — Design System

**Codename: `Bench`.** The visual and interaction foundation for the Client (iOS 17+, SwiftUI).

This document is the single source of truth for colour, type, spacing, iconography, motion, components, data visualisation, accessibility and localisation. Every value here is **concrete and transcribable**. An engineer should be able to build the Asset Catalog and the token file from §12 without asking a question.

**Read first:** [00-GLOSSARY](00-GLOSSARY.md). This document uses *Agent, Client, Tunnel, Channel, Snapshot, Series, Action, Alert Rule, Remote Desktop, Remote Shell* with exactly the Glossary meanings and never as loose synonyms.

**Related:** [01-BRD](01-BRD.md) (why), [02-SRS](02-SRS.md) (numbered requirements), [03-ARCHITECTURE](03-ARCHITECTURE.md) (what produces the data), [04-SECURITY-E2EE](04-SECURITY-E2EE.md) (fingerprints, pairing, key state — the states §7.12 renders), [05-PROTOCOL](05-PROTOCOL.md) (Channel + error codes surfaced in §7.10), [06-DATA-MODEL](06-DATA-MODEL.md) (Series, Rollup, retention — the substrate for §8), [07-UX-SPEC](07-UX-SPEC.md) (screens that compose these components), [08-WIDGETS](08-WIDGETS.md) (the reduced token set for WidgetKit), [09-TEST-PLAN](09-TEST-PLAN.md) (contrast and Dynamic Type acceptance), [10-ROADMAP](10-ROADMAP.md), [11-AGENT-DEPLOYMENT](11-AGENT-DEPLOYMENT.md), [12-RISK-REGISTER](12-RISK-REGISTER.md).

---

## 0. The design brief, in one paragraph

The Client is a **remote instrument panel**, not a dashboard product. It is held in one hand, often outdoors, often in a hurry, and its job is to answer *"is my Pi alright, and can I reach it right now?"* before the user has finished raising the phone. The visual language borrows from bench instruments and network hardware: a dark graphite chassis, hairline separations, dense aligned numerals, and a single cool signal colour that means *live, linked, verified*. It never borrows from consumer gauges, skeuomorphic dials, glow effects, or gamified badges. There is exactly one accent hue and it is never spent on decoration.

**The identity in five values**

| | Value | Why this one |
|---|---|---|
| Ground | `#0B0F12` graphite (dark) / `#EEF1F3` (light) | A blue-green-biased near-black, not pure black. Pure black on OLED makes hairlines vanish and makes the chassis read as "off"; a 6% ground keeps every hairline and card edge measurable. |
| Accent | **Signal Cyan** `#2FBCCF` / `#026E77` | The colour of a carrier/link lamp on network gear. Cool, unexcited, and — critically — **not** any of the six status hues, so an accent can never be misread as a health state. |
| Neutral bias | slate with a cyan cast (hue ≈ 220–245° OKLCH) | Chosen, not inherited. A pure grey next to a cyan accent reads as unconsidered. |
| Numerals | SF Mono, tabular, everywhere a metric appears | Digits that jitter under live update destroy the "precision instrument" read faster than any other single defect. |
| Structure | 4pt grid, 1pt hairlines, 12pt module radius | Instrument face plates, not cards floating in space. |

---

## 1. Design principles

Six principles. Each is testable; each has a do and a don't. [09-TEST-PLAN](09-TEST-PLAN.md) should carry an acceptance case per principle.

### P-D1 — Status legible in half a second

The health of an Agent must be readable from a glance at arm's length, before any text is parsed. Shape and position carry the state; colour confirms it.

- **Do** — put the StatusPill in the same absolute position on every surface that has one (leading edge, baseline-aligned with the Agent name), so the eye learns one location.
- **Don't** — communicate degradation only by dimming a number or by a subtle colour shift inside a chart.

### P-D2 — Never fake liveness

Animation, motion and shimmer are reserved for events that actually happened. A pulsing dot means a frame or Snapshot arrived. A moving chart means a sample landed. Nothing on screen may imply data the Client does not hold.

- **Do** — freeze the last known value, dim it to `text.secondary`, and stamp it with an age (`updated 4 min ago`) the moment the Tunnel is not delivering.
- **Don't** — run an idle "breathing" animation on a metric, interpolate a Sparkline across a gap, or keep a spinner turning while nothing is being awaited.

### P-D3 — Encryption state is always visible, never celebrated

The Tunnel's security posture (verified peer, direct vs relayed path, rekey pending) is ambient chrome that is always on screen, rendered at low volume. It is never a modal congratulation and never a green shield badge.

- **Do** — a 20pt-tall ConnectionBanner strip under the navigation bar carrying path, latency and lock glyph, in `text.secondary` when nominal.
- **Don't** — show a full-width green "You are secure!" panel, or hide the security state behind a tap.

### P-D4 — Density is a courtesy, not a flex

The user is technically strong. Show the number, the unit, the threshold and the timestamp — but never at the cost of a 44pt hit target or a legible line length. Density comes from removing chrome, not from shrinking type.

- **Do** — remove card shadows, section headers and separators before you remove a value.
- **Don't** — go below 11pt for any text, or below 44×44pt for any control, to fit more in.

### P-D5 — Destructive is deliberate, reversible is instant

Rebooting a Pi you are 300 km away from is not undoable. The weight of the confirmation must match the weight of the consequence, and everything that *is* reversible must have no confirmation at all.

- **Do** — require a typed or slid confirmation plus a biometric check for Actions marked destructive in [02-SRS](02-SRS.md); require nothing to change a chart's time range.
- **Don't** — use a generic "Are you sure?" alert for both a reboot and a widget refresh.

### P-D6 — Degrade visibly, fail honestly

Per README principle P5, observability degrades rather than fails. The interface must make the degradation *the message*: a relayed path, a backfilled gap, a stale Snapshot and an unreachable Agent are four different pictures, and the user must be able to tell which one they are looking at without opening Diagnostics.

- **Do** — render a disconnection as an explicit hatched gap in every chart it touches, at the correct x-position and width.
- **Don't** — bridge the gap with a straight line, or drop the samples and let the chart shrink.

---

## 2. Colour system

### 2.1 How this palette was built and validated

The palette was **computed, then measured** — it was not picked by eye. The procedure is the one in the `dataviz` skill, run in this order:

1. **Form before colour.** Chart forms were selected per metric (§8.1) before any hue was chosen, so no colour is doing a job that geometry should do.
2. **Job-based assignment.** Every colour in this system does exactly one of five jobs: *categorical* (Series identity), *ordinal/sequential* (magnitude), *diverging* (polarity about a baseline), *status* (state), or *chrome* (surfaces, ink, hairlines). No colour does two.
3. **Snap to band.** Each hue was generated in OKLCH at a target lightness inside the mode's band (**L 0.48–0.67 dark, L 0.43–0.77 light**) with chroma at or above the **C ≥ 0.10** floor, gamut-clamped to sRGB.
4. **Order search.** All 8! orderings of the eight categorical hues were enumerated with slot 1 pinned to the accent hue, and scored on the minimum adjacent CVD ΔE across **both** modes. The adopted order is the top-scoring order that also (a) validates its **first three slots under `--pairs all`** and (b) keeps the status-colliding hues (green, yellow, red) out of slots 1–3.
5. **Validation.** `scripts/validate_palette.js` was run per mode against **this system's own surfaces** (`#141A1F` dark card, `#FFFFFF` light card) — not the skill's default surfaces. CVD simulation is Machado–Oliveira–Fernandes 2009 at severity 1.0, protanopia and deuteranopia, ΔE as Euclidean distance in OKLab ×100.
6. **WCAG pass.** Every foreground/background pair in §2.2–§2.9 carries a measured ratio. Text pairs are held to **≥ 4.5:1**; UI and graphical objects (marks, borders that carry meaning, control outlines) to **≥ 3:1**.

**Measured results (verbatim from the validator):**

| Palette | Mode | Surface | Lightness band | Chroma floor | CVD separation | Normal-vision floor | Contrast |
|---|---|---|---|---|---|---|---|
| Categorical ×8, adjacent | dark | `#141A1F` | PASS — all 8 in L 0.48–0.67 | PASS — all ≥ 0.10 | **PASS — worst adjacent ΔE 10.0** (magenta↔green, deutan); tritan 9.7 | **PASS — worst adjacent ΔE 23.9** | PASS — all ≥ 3:1 |
| Categorical ×8, adjacent | light | `#FFFFFF` | PASS — all 8 in L 0.43–0.77 | PASS — all ≥ 0.10 | **PASS — worst adjacent ΔE 10.7** (magenta↔green, deutan); tritan 9.9 | **PASS — worst adjacent ΔE 23.9** | PASS — all ≥ 3:1 |
| Categorical slots 1–3, `--pairs all` | dark | `#141A1F` | PASS | PASS | **PASS — worst pair ΔE 10.1** (violet↔cyan, deutan); tritan 10.8 | **PASS — ΔE 18.7** | PASS |
| Categorical slots 1–3, `--pairs all` | light | `#FFFFFF` | PASS | PASS | **PASS — worst pair ΔE 16.6** (orange↔cyan, deutan); tritan 14.1 | **PASS — ΔE 23.9** | PASS |

Both modes clear the ΔE ≥ 8 **target** (not merely the 6–8 floor), so no categorical pair in this system depends on secondary encoding to be told apart. Secondary encoding is shipped anyway (§8.9) because it is cheap and because it also covers print, `forced-colors`, and grayscale screenshots.

**Deuteranopia / protanopia safety, stated plainly.** Under both simulations at full severity, the worst *neighbouring* pair in an eight-Series stack, bar group or line chart separates by ΔE 10.0 (dark) / 10.7 (light) — comfortably above the 8.0 target. Tritanopia, which the method treats as informational rather than gating, measures 9.7 / 9.9 on the same pairlist. For **all-pairs** forms — scatter, bubble, small multiples, the per-core CPU grid — this system carries a hard **series cap of three**; a fourth Series in an all-pairs form must fold into "Other" or become a facet. This is a cap, not a palette change: no ordering of eight hues can clear the all-pairs floors, so adding a hue would only hide the collapse.

**Re-validation is mandatory** whenever any hex in §2.2–§2.8 changes. The command, per mode:

```
node scripts/validate_palette.js "#10a6ad,#d67523,#8b78de,#2e9e52,#cf60a4,#ab9017,#4687d8,#d7564d" --mode dark  --surface "#141A1F"
node scripts/validate_palette.js "#00999f,#b65e07,#7838f8,#08833c,#c60f91,#8b7404,#0d6bcc,#c70a18" --mode light --surface "#FFFFFF"
```

> **Dark mode is the primary appearance.** It was designed first and every value below lists dark before light. Light mode is a *selected* companion set — each hue re-stepped for a white ground and re-validated — never an algorithmic inversion.

### 2.2 Surfaces

Four elevation planes plus a scrim. The Client is flat: elevation is expressed by **surface value and hairline**, and only sheets and menus carry a shadow (§4.6).

**Dark (primary)**

| Token | Hex | Used for | Ratio vs `surface.canvas` |
|---|---|---|---|
| `surface.canvas` | `#0B0F12` | Screen background, tab bar background, scroll background | — |
| `surface.raised` | `#141A1F` | AgentCard, StatTile, MetricChart card, AlertRow group, list rows | 1.24:1 |
| `surface.raised2` | `#1C242B` | Nested surfaces inside a raised card; sheet background; keyboard accessory bar | 1.55:1 |
| `surface.sunken` | `#06090B` | TerminalSurface, DesktopViewport letterbox, chart plot well | 1.19:1 (vs canvas, inverted) |
| `surface.overlay` | `#1F2831` | Menus, tooltips, scrub readout, toast | 1.72:1 |
| `surface.scrim` | `#000000` @ 62% | Behind sheets and destructive confirmations | — |

**Light**

| Token | Hex | Used for | Ratio vs `surface.canvas` |
|---|---|---|---|
| `surface.canvas` | `#EEF1F3` | Screen background | — |
| `surface.raised` | `#FFFFFF` | Cards, tiles, list rows | 1.13:1 |
| `surface.raised2` | `#F7F9FA` | Nested surfaces, sheets | 1.07:1 |
| `surface.sunken` | `#E2E7EA` | Chart plot well, well-style inputs | 1.06:1 |
| `surface.overlay` | `#FFFFFF` | Menus, tooltips, toast | 1.13:1 |
| `surface.scrim` | `#0D1418` @ 40% | Behind sheets | — |

> **TerminalSurface exception.** `TerminalSurface` and `DesktopViewport` default to the **dark** surface and dark ANSI palette in *both* appearances, because a terminal that flips to white under a system appearance change destroys colour-coded shell output the user has memorised. Settings → Appearance exposes `Terminal theme: Always dark (default) / Follow system`. See [07-UX-SPEC](07-UX-SPEC.md) §Settings.

### 2.3 Borders and hairlines

| Token | Dark | Ratio vs `surface.raised` | Light | Ratio vs `surface.raised` | Use |
|---|---|---|---|---|---|
| `border.hairline` | `#232C34` | 1.24:1 | `#DCE3E7` | 1.30:1 | Dividers *inside* a card; list row separators. Decorative — no contrast minimum. |
| `border.subtle` | `#2A343C` | 1.38:1 (1.52:1 vs canvas) | `#D3DBE0` | 1.40:1 | Card and tile outline; chart plot frame. |
| `border.strong` | `#5A6873` | **3.06:1** | `#78848B` | **3.84:1** | Meaning-bearing borders: text field outline, unselected segmented control, checkbox rim, GaugeRing track cap. Meets the 3:1 UI-object minimum. |
| `border.focus` | `#2FBCCF` | 7.70:1 | `#026E77` | 6.00:1 | Keyboard/Full Keyboard Access focus ring, 2pt, 2pt offset. |
| `border.destructive` | `#F2564F` | 5.19:1 | `#C22118` | 5.96:1 | Outline of destructive confirm affordances. |

Widths: `border.width.hairline` = **1 / UIScreen.main.scale** pt (a true device hairline, ≈0.33pt on @3x); `border.width.regular` = **1pt**; `border.width.emphasis` = **2pt** (focus, selected, destructive).

### 2.4 Text

**Dark (primary)**

| Token | Hex | vs `canvas` #0B0F12 | vs `raised` #141A1F | vs `raised2` #1C242B | vs `overlay` #1F2831 | Verdict |
|---|---|---|---|---|---|---|
| `text.primary` | `#EEF3F5` | 17.20:1 | 15.68:1 | 14.05:1 | 13.35:1 | ✅ ≥4.5 |
| `text.secondary` | `#A7B4BC` | 9.07:1 | 8.27:1 | 7.41:1 | 7.04:1 | ✅ ≥4.5 |
| `text.tertiary` | `#85929A` | 6.03:1 | 5.49:1 | 4.92:1 | 4.68:1 | ✅ ≥4.5 |
| `text.disabled` | `#4E5A62` | 2.71:1 | 2.47:1 | 2.22:1 | 2.11:1 | Exempt (WCAG 1.4.3 inactive-control exception) |
| `text.onAccent` | `#04191C` | — | on `#2FBCCF`: **7.94:1** | — | — | ✅ ≥4.5 |
| `text.onCritical` | `#140605` | — | on `#F2564F`: **5.88:1** | — | — | ✅ ≥4.5 |

**Light**

| Token | Hex | vs `canvas` #EEF1F3 | vs `raised` #FFFFFF | vs `raised2` #F7F9FA | vs `sunken` #E2E7EA | Verdict |
|---|---|---|---|---|---|---|
| `text.primary` | `#0D1418` | 16.38:1 | 18.58:1 | 17.59:1 | 14.91:1 | ✅ ≥4.5 |
| `text.secondary` | `#4A5860` | 6.48:1 | 7.35:1 | 6.96:1 | 5.90:1 | ✅ ≥4.5 |
| `text.tertiary` | `#5E6C74` | 4.78:1 | 5.42:1 | 5.13:1 | 4.35:1 | ✅ ≥4.5 on canvas/raised; **must not be used on `sunken`** |
| `text.disabled` | `#9AA6AD` | 2.20:1 | 2.49:1 | 2.36:1 | 2.00:1 | Exempt |
| `text.onAccent` | `#FFFFFF` | — | on `#026E77`: **6.00:1** | — | — | ✅ ≥4.5 |
| `text.onCritical` | `#FFFFFF` | — | on `#C22118`: **5.96:1** | — | — | ✅ ≥4.5 |

**Rule:** `text.tertiary` is the floor. There is no fourth grey. Anything you were tempted to render below `text.tertiary` should either be removed or promoted.

### 2.5 Accent — Signal Cyan

One accent. It marks **interactivity and identity**, never health.

| Token | Dark | vs canvas | vs raised | Light | vs canvas | vs raised | Use |
|---|---|---|---|---|---|---|---|
| `accent.base` | `#2FBCCF` | 8.44:1 | 7.70:1 | `#026E77` | 5.29:1 | 6.00:1 | Tint colour, active tab, links, selected segment, primary button fill, focus ring |
| `accent.high` | `#5AD0E0` | 10.57:1 | 9.63:1 | `#0A8B96` | 3.60:1 | 4.08:1 | Highlighted (pointer hover, iPad/Vision), chart endpoint dot |
| `accent.pressed` | `#1E93A3` | 5.28:1 | 4.81:1 | `#015159` | 7.97:1 | 9.04:1 | Pressed state fill/ink |
| `accent.muted` | `#0E6874` | 2.98:1 | 2.72:1 | `#B7E4EA` | — | 1.37:1 | Large fills, selected-row background, chart area wash base |
| `accent.wash` | `accent.base` @ 12% over surface | ≈1.34:1 | — | `accent.base` @ 10% | — | — | Selection wash, sparkline area fill, Tunnel-active row tint |

`accent.high` in **light** mode measures 3.60:1 on canvas — above the 3:1 graphical-object minimum but **below 4.5:1**, so it is legal as a *mark or fill* and **never as text**. Light-mode accent text always uses `accent.base` (5.29:1 / 6.00:1).

**Measured separation from status:** accent vs `status.info` ΔE 11.2, accent vs `status.ok` ΔE 14.8 (unsimulated OKLab ×100, dark). The accent and the info blue are the closest pair in the system; they co-occur only in ConnectionBanner, where the accent appears as a control tint on the trailing edge and info appears as a leading glyph + label. Never place them adjacent without labels.

### 2.6 Semantic status ramp

Six states. This ramp is **reserved**: no state colour may ever be reused as a Series colour, and no Series colour may stand in for a state.

**Dark (primary)**

| Token | Hex | vs canvas | vs raised | vs overlay | Meaning in this product | Mandatory glyph (§5) |
|---|---|---|---|---|---|---|
| `status.ok` | `#2FB463` | 7.17:1 | 6.54:1 | 5.57:1 | Agent reachable, Tunnel established, all Alert Rules quiet | `checkmark.circle.fill` |
| `status.info` | `#4E9BEC` | 6.62:1 | 6.03:1 | 5.14:1 | Nominal but noteworthy: relayed path, backfill in progress, rekey scheduled | `info.circle.fill` |
| `status.warning` | `#E0A61C` | 8.83:1 | 8.05:1 | 6.86:1 | An Alert Rule is firing at warning severity; Snapshot older than its interval | `exclamationmark.triangle.fill` |
| `status.critical` | `#F2564F` | 5.70:1 | 5.19:1 | 4.42:1 | An Alert Rule is firing at critical severity; handshake failed; fingerprint mismatch | `exclamationmark.octagon.fill` |
| `status.offline` | `#7A8A94` | 5.40:1 | 4.92:1 | 4.19:1 | Agent known-unreachable — a *positive* determination | `bolt.horizontal.circle` |
| `status.unknown` | `#9A938A` | 6.34:1 | 5.78:1 | 4.92:1 | The Client does not know — never contacted, cache expired, first launch | `questionmark.circle` |

**Light**

| Token | Hex | vs canvas | vs raised | vs sunken | Verdict |
|---|---|---|---|---|---|
| `status.ok` | `#0F7A3D` | 4.78:1 | 5.42:1 | 4.35:1 | ✅ text ≥4.5 on canvas/raised |
| `status.info` | `#1160C4` | 5.30:1 | 6.01:1 | 4.82:1 | ✅ |
| `status.warning` | `#8A6100` | 4.88:1 | 5.54:1 | 4.45:1 | ✅ |
| `status.critical` | `#C22118` | 5.25:1 | 5.96:1 | 4.78:1 | ✅ |
| `status.offline` | `#5B6970` | 5.00:1 | 5.68:1 | 4.56:1 | ✅ |
| `status.unknown` | `#6E665C` | 4.98:1 | 5.65:1 | 4.53:1 | ✅ |

Every status token clears **4.5:1 as text** in both modes on `canvas` and `raised`. This is stricter than the skill's reference palette, which lets warning and serious sit below 3:1 on light and leans entirely on the icon+label pairing. Here the pairing is *also* mandatory (§2.11) — but the colours were re-stepped so that a user who reads the coloured label alone is never below the text minimum.

**Offline vs unknown is deliberately a weak colour pair** — measured ΔE 5.8 (unsimulated, dark). This is stated rather than hidden: the two states are both "grey" because neither is an alarm, and they are distinguished by **glyph, label text and fill treatment** (offline = solid fill; unknown = 1pt dashed outline, no fill). Colour carries none of the distinction. Any design that tries to separate them by hue alone is wrong.

**Warning ↔ critical separates by ΔE 19.2** — the pair that matters most is the strongest in the ramp.

**Severity mapping.** [02-SRS](02-SRS.md) defines Alert Rule severities; they map 1:1 — `info → status.info`, `warning → status.warning`, `critical → status.critical`. If a `serious` tier is introduced between warning and critical, it takes `#EE7B2E` dark / `#B0521A` light (6.27:1 / 5.16:1) and inherits `exclamationmark.triangle.fill` with a filled backing.

### 2.7 Thermal ramp

Temperature is the one metric where the user has a physical intuition, and Raspberry Pi has real, published thresholds (soft throttle at 80 °C, hard throttle at 85 °C). The ramp is therefore anchored to those numbers, not to percentiles.

This is a **semantic-heat ramp** — the one multi-hue sequential form the method permits, alongside analogous neighbours. It qualifies on both counts: amber → red are analogous OKLCH neighbours (hue 88° → 25°) *and* the mapping is semantic heat. The licence comes with three non-negotiable conditions, all enforced here: **(a)** a scale legend is always present wherever the ramp is used as a fill; **(b)** the numeric value in °C is always rendered beside the mark; **(c)** the ramp is monotone in OKLCH lightness with adjacent ΔL ≥ 0.06, so it survives grayscale and print.

**Validator result (ordinal mode):** Lightness monotone ✅ · Adjacent ΔL ✅ all gaps ≥ 0.06 · Light-end contrast ✅ 3.13:1 (floor 2:1) · Single hue ❌ hue spread 63° — *the documented semantic-heat exception, accepted under conditions (a)–(c) above*.

| Step | Band (CPU / SoC) | Dark | vs raised | Light | vs raised | Reading |
|---|---|---|---|---|---|---|
| `thermal.nominal` | < 50 °C | `text.secondary` `#A7B4BC` | 8.27:1 | `text.secondary` `#4A5860` | 7.35:1 | No heat colour at all. Cold carries no information on a Pi. |
| `thermal.1` | 50 – 60 °C | `#E6B731` | 9.34:1 | `#B58C00` | 3.13:1 | Warm — normal under load |
| `thermal.2` | 60 – 67 °C | `#E89400` | 7.24:1 | `#AF6F00` | 4.12:1 | Warm — sustained load |
| `thermal.3` | 67 – 74 °C | `#E76E08` | 5.54:1 | `#AA4D00` | 5.57:1 | Hot — check airflow |
| `thermal.4` | 74 – 80 °C | `#DB4822` | 4.14:1 | `#A22400` | 7.53:1 | Very hot — approaching soft throttle |
| `thermal.5` | ≥ 80 °C | `#C9222B` | 3.13:1 | `#8C0010` | 9.89:1 | Throttling. Fixed annotation at 80 °C and 85 °C on every temperature chart. |

**Thermal steps are mark colours only.** `thermal.1` light (3.13:1) and `thermal.5` dark (3.13:1) clear the 3:1 graphical-object minimum but not 4.5:1, so the °C figure itself always wears a text token, never a thermal token. This is the general rule of §2.11 applied to its hardest case.

### 2.8 Data-visualisation palettes

#### 2.8.1 Categorical — Series identity

Eight slots, **fixed order, assigned in sequence, never cycled**. Slot 1 is the accent hue stepped into the mark band, so a single-Series chart wears the app's own colour and needs no legend.

| Slot | Hue | Dark | vs raised `#141A1F` | Light | vs raised `#FFFFFF` | Typical assignment |
|---|---|---|---|---|---|---|
| 1 | cyan | `#10A6AD` | 5.91:1 | `#00999F` | 3.47:1 | The primary Series of the chart (`cpu.util_pct`, `net.rx_bps`, core 0) |
| 2 | orange | `#D67523` | 5.37:1 | `#B65E07` | 4.57:1 | The natural counterpart (`net.tx_bps`, core 1) |
| 3 | violet | `#8B78DE` | 4.88:1 | `#7838F8` | 5.65:1 | Third Series / third core |
| 4 | green | `#2E9E52` | 5.12:1 | `#08833C` | 4.86:1 | Fourth |
| 5 | magenta | `#CF60A4` | 4.90:1 | `#C60F91` | 5.41:1 | Fifth |
| 6 | yellow | `#AB9017` | 5.62:1 | `#8B7404` | 4.57:1 | Sixth |
| 7 | blue | `#4687D8` | 4.78:1 | `#0D6BCC` | 5.26:1 | Seventh |
| 8 | red | `#D7564D` | 4.45:1 | `#C70A18` | 6.03:1 | Eighth |

Every slot clears the 3:1 graphical-object minimum in both modes with margin; the weakest is light-mode cyan at 3.47:1, which is a *mark* colour and is never used as text (§2.11 rule 11).

**Why this order.** Slot 1 is pinned to the accent hue. Among the 56 orderings that clear every adjacent gate in both modes, this is the highest-scoring one that *also* validates slots 1–3 under `--pairs all` **and** pushes the three status-colliding hues (green, yellow, red) to slots 4, 6 and 8. That last constraint is product-specific and load-bearing: a two- or three-Series chart in a monitoring app must never accidentally paint a Series in something that reads as "healthy" or "on fire". Red is last for exactly this reason.

**Series count ladder**

| Series | Treatment |
|---|---|
| 1 | Slot 1 only. No legend — the chart title names it. Direct-label the endpoint. |
| 2–3 | Slots 1–3. Legend present. Direct-label all endpoints. Safe in all-pairs forms. |
| 4 | Slots 1–4. Legend present, direct labels **mandatory**. Adjacent forms only — no scatter, no small multiples. |
| 5–6 | Soft cap. Legend + small multiples preferred over one dense plot. |
| 7–8 | Token ceiling. |
| 9+ | **Never a ninth hue.** Fold the tail into "Other" (`text.tertiary`), facet into small multiples, or switch to a table. On the per-core CPU chart this binds at 8 cores; a hypothetical 16-core host renders as a heatmap (§8.1), not sixteen lines. |

**Colour follows the entity.** A Series keeps its slot across filter changes, time-range changes, and Agent switches within a session. Filtering core 3 out of the per-core chart must not repaint cores 4–8. Slot assignment is by stable Series key from [06-DATA-MODEL](06-DATA-MODEL.md), never by row index.

#### 2.8.2 Sequential — magnitude

One hue (cyan), seven steps, light → dark. Used for heatmaps (per-core utilisation over time, disk I/O by hour), choropleth-style grids, and meter tracks.

| Step | Hex | vs `#FFFFFF` (light) | vs `#141A1F` (dark) |
|---|---|---|---|
| 100 | `#B7E4EA` | 1.37:1 | 12.78:1 |
| 200 | `#8FD3DD` | 1.68:1 | 10.47:1 |
| 300 | `#63C0CD` | 2.11:1 | 8.31:1 |
| 400 | `#2FA9BA` | 2.80:1 | 6.27:1 |
| 500 | `#0B8B9B` | 4.05:1 | 4.33:1 |
| 600 | `#046F7C` | 5.88:1 | 2.98:1 |
| 700 | `#01545E` | 8.64:1 | 2.03:1 |

- **Light mode, continuous magnitude:** full 100 → 700, lightest = near zero (allowed to recede toward the surface).
- **Dark mode, continuous magnitude:** the anchor flips — 700 → 100, darkest = near zero.
- **Ordinal use** (discrete ordered buckets: severity tiers, quality presets, disk fill bands) must keep every step readable: on light start no lighter than **step 300** (`#63C0CD`, 2.11:1); on dark go no darker than **step 700** (`#01545E`, 2.03:1). Both clear the 2:1 ordinal floor.
- If a second sequential context appears on the same screen, it takes the **slot-2 orange** hue as its own one-hue ramp. Never two cyan ramps side by side.

#### 2.8.3 Diverging — polarity about a baseline

Cyan ↔ orange, neutral grey midpoint. Warm/cool poles that read as opposite; the midpoint reads as "nothing". Used for: deviation from a rolling baseline, load-average delta vs core count, free-space trend vs last week, clock drift.

| Step | Meaning | Dark | vs raised | Light | vs raised |
|---|---|---|---|---|---|
| −3 | strongly below | `#B7E4EA` | 12.78:1 | `#01545E` | 8.64:1 |
| −2 | below | `#63C0CD` | 8.31:1 | `#0B8B9B` | 4.05:1 |
| −1 | slightly below | `#12909F` | 4.61:1 | `#63C0CD` | 2.11:1 |
| 0 | neutral | `#3A444C` | 1.76:1 | `#D5DBDF` | 1.40:1 |
| +1 | slightly above | `#B0651F` | 3.95:1 | `#E9A868` | 2.05:1 |
| +2 | above | `#E08A46` | 6.59:1 | `#B96E14` | 3.96:1 |
| +3 | strongly above | `#F5BE72` | 10.43:1 | `#7A4405` | 7.90:1 |

Equal step count per arm. The midpoint is **grey, never a hue** — a hue at the midpoint would make "no deviation" look like a category. Blue↔aqua and cyan↔green were both rejected: two cool poles do not read as opposite.

#### 2.8.4 Chart chrome and ink

| Role | Dark | vs raised | Light | vs raised |
|---|---|---|---|---|
| Chart card surface | `#141A1F` | — | `#FFFFFF` | — |
| Plot well (optional inset) | `#06090B` | 1.19:1 | `#E2E7EA` | 1.25:1 |
| Gridline (hairline, **solid**) | `#1E262D` | 1.14:1 | `#E7ECEF` | 1.19:1 |
| Baseline / axis rule | `#2E3941` | 1.48:1 | `#CBD4D9` | 1.50:1 |
| Axis tick labels | `text.tertiary` `#85929A` | 5.49:1 | `text.tertiary` `#5E6C74` | 5.42:1 |
| De-emphasised Series ("Other", context lines) | `#5A6873` | 3.06:1 | `#78848B` | 3.84:1 |
| Gap / no-data hatch ink | `#39434B` | 1.74:1 | `#C6CFD4` | 1.58:1 |
| Threshold rule (Alert Rule) | `status.warning` / `status.critical` | 8.05 / 5.19 | `status.warning` / `status.critical` | 5.54 / 5.96 |
| Scrub crosshair | `text.secondary` `#A7B4BC` | 8.27:1 | `text.secondary` `#4A5860` | 7.35:1 |

Gridlines and axes are **solid 1pt hairlines**, never dashed. Dashing is reserved system-wide for exactly two meanings: an Alert Rule threshold rule (2pt, 4-on-3-off) and the `status.unknown` outline.

### 2.9 Terminal ANSI palette

For `TerminalSurface` (§7.8) and any log rendering that honours ANSI SGR. Measured on the terminal ground `#06090B`. All sixteen clear 3:1; all but `black` clear 4.5:1 (`black` is a background/dim colour, never used as foreground text by well-behaved programs, and the emulator substitutes `brBlack` if a program sets fg=0 on bg=0).

| ANSI | Name | Dark hex | vs `#06090B` | Light hex | vs `#F7F9FA` |
|---|---|---|---|---|---|
| 0 | black | `#3A444C` | 2.01:1 | `#1B2429` | 14.94:1 |
| 1 | red | `#E2685F` | 6.07:1 | `#B3241C` | 6.24:1 |
| 2 | green | `#3CC06F` | 8.52:1 | `#0B6B35` | 6.28:1 |
| 3 | yellow | `#D9A72B` | 9.05:1 | `#7A5600` | 6.30:1 |
| 4 | blue | `#5A9CE8` | 6.99:1 | `#0F57B0` | 6.61:1 |
| 5 | magenta | `#C97BC8` | 6.80:1 | `#96257F` | 6.93:1 |
| 6 | cyan | `#2FBCCF` | 8.76:1 | `#026E77` | 5.68:1 |
| 7 | white | `#C7D1D7` | 12.87:1 | `#5E6C74` | 5.13:1 |
| 8 | bright black | `#5A6873` | 3.48:1 | `#78848B` | 3.63:1 |
| 9 | bright red | `#FF8078` | 8.19:1 | `#8E1912` | 8.65:1 |
| 10 | bright green | `#5AD98A` | 11.15:1 | `#075428` | 8.62:1 |
| 11 | bright yellow | `#EFBE47` | 11.53:1 | `#5E4200` | 8.82:1 |
| 12 | bright blue | `#7FB6F2` | 9.39:1 | `#0B4489` | 9.03:1 |
| 13 | bright magenta | `#DE97DC` | 9.10:1 | `#751C63` | 9.46:1 |
| 14 | bright cyan | `#5AD4E4` | 11.38:1 | `#01545E` | 8.18:1 |
| 15 | bright white | `#EEF3F5` | 17.85:1 | `#0D1418` | 17.59:1 |

Cursor: `accent.base`, 2pt bar in insert mode, filled block when the Remote Shell has focus and the app is foreground, hollow 1pt block when backgrounded. Selection: `accent.base` @ 24%. 256-colour and truecolour SGR pass through unmodified — the sixteen above are only the base map.

### 2.10 Mapping to iOS semantic colours and the Asset Catalog

**Every token above ships as a named Color Set in `Colors.xcassets`** with an *Any Appearance* (= Light) and a *Dark Appearance* value. Nothing is defined in Swift. Nothing uses a raw hex at a call site. Nothing uses `UIColor.systemX` directly.

| Concern | Decision |
|---|---|
| Asset Catalog structure | One folder per group, mirroring §12: `surface/`, `border/`, `text/`, `accent/`, `status/`, `thermal/`, `viz/`, `terminal/`. Set names use the dotted token name verbatim (`status.warning`), so `Color("status.warning", bundle: .main)` resolves without a lookup table. |
| Colour space | **Display P3** container with the sRGB values above as the authored numbers. Every hex here is sRGB; authoring in P3 with sRGB values keeps the measured ratios exact and leaves headroom if a future wide-gamut accent is introduced. |
| High Contrast | Each Color Set carries a **High Contrast** variant for both appearances. Rule: text tokens step one level toward the ground (`text.secondary` dark → `#C2CDD4`, 12.0:1); `border.hairline` is promoted to `border.subtle`; `border.subtle` to `border.strong`; status and thermal tokens are unchanged (already ≥4.5:1); `accent.high` light is replaced by `accent.base`. |
| `tintColor` | The app's global tint is `accent.base`. Set once at the root; never overridden per-view except on destructive controls, which tint `status.critical`. |
| Where iOS semantics *are* used | `Color.clear`, materials (`.regularMaterial` for the keyboard accessory bar and the DesktopViewport control overlay only), `separator` is **not** used (we ship `border.hairline` so the value is identical in widgets, where UIKit semantics are unavailable). |
| Widgets | WidgetKit cannot read `UITraitCollection` the same way; every token used in [08-WIDGETS](08-WIDGETS.md) must exist as a Color Set in a target shared with the widget extension. The widget token subset is listed there. |
| Vibrancy | Not used. Vibrant text over materials cannot be contrast-measured reliably, and P-D1 requires measurable status legibility. |

### 2.11 Never do this

1. **Never encode status by hue alone.** Every status colour ships with its SF Symbol *and* a text label. A StatusPill with a coloured dot and no glyph is a defect, not a style choice.
2. **Never reuse a status colour as a Series colour**, or a Series colour as a status. If a Series *means* good/bad (error rate, failed-unit count, packet loss) it wears status tokens; if it is just "the third core" it wears categorical.
3. **Never use a dual-axis chart.** Two measures with different scales become two charts, small multiples, or both indexed to a common base on one axis. This is the single most common way a monitoring chart invents a correlation.
4. **Never colour a text label with a Series colour.** Marks carry the Series colour; labels, values, legends and axis text wear text tokens. Identity comes from a swatch or line-key *beside* the text.
5. **Never generate a ninth categorical hue.** Fold, facet, or tabulate.
6. **Never put a hue at a diverging midpoint**, and never pair two cool hues as diverging poles.
7. **Never use a value-ramp on nominal categories.** Colouring each mounted filesystem darker-where-fuller double-encodes what bar length already shows and burns the identity channel.
8. **Never use pure black `#000000` as a surface**, except inside `DesktopViewport` letterboxing where it is genuinely absent signal.
9. **Never use red for anything that is not critical.** Not for "record", not for "stop streaming", not for a delete affordance that is actually reversible.
10. **Never use green to mean "connected" and also to mean "healthy".** In this system green means exactly one thing: *no Alert Rule is firing*. Connection state is carried by `accent` (live), `status.info` (relayed), `status.offline` and `status.unknown`.
11. **Never render a thermal or Series colour as body text.** They are validated as marks (≥3:1), not as text.
12. **Never dim a value to indicate staleness without also stating the age.** Dimming alone is ambiguous with "disabled".

---

## 3. Typography

### 3.1 Faces

| Face | Where | Why |
|---|---|---|
| **SF Pro Text** | All UI text ≤ 19pt: body, labels, list rows, buttons, captions | Optimised for small optical sizes; the default. |
| **SF Pro Display** | All text ≥ 20pt: screen titles, hero readouts, large section heads | Tighter default tracking at display sizes; we tighten further (below). |
| **SF Mono** | **Every numeric readout, every metric, every unit, every timestamp, every fingerprint, every hostname/IP, all terminal output, all log bodies** | Fixed advance width means a live-updating figure cannot change layout width. This is the single most identity-defining typographic decision in the system. |
| **SF Arabic** (Text/Display) | Arabic locale UI text | Ships with iOS; matches SF Pro metrics. See §10. |

There is no fourth face. No serif, no display face, no webfont. A hero readout is SF Mono at 44pt, not a decorative face — a decorative figure reads as off-brand ornament in an instrument.

### 3.2 Type scale

Sizes are the **base (Large / default Dynamic Type)** values. Tracking is in points at the base size and scales proportionally. Line height is absolute at base size and scales with the size.

| Role | Face | Size | Weight | Line height | Tracking | Figures | Typical use |
|---|---|---|---|---|---|---|---|
| `type.hero` | SF Mono | 44pt | Medium | 48pt | −1.0 | tabular | The one number a screen leads with (Dashboard headline metric) |
| `type.display` | SF Pro Display | 34pt | Bold | 40pt | −0.6 | — | Large title (Dashboard, Agents) |
| `type.title1` | SF Pro Display | 28pt | Semibold | 34pt | −0.4 | — | Inline navigation title, sheet title |
| `type.title2` | SF Pro Display | 22pt | Semibold | 28pt | −0.3 | — | Section head on a detail screen |
| `type.title3` | SF Pro Text | 20pt | Semibold | 25pt | −0.2 | — | Card title, Agent name in AgentCard |
| `type.metric.xl` | SF Mono | 32pt | Medium | 36pt | −0.8 | tabular | Metric detail current value |
| `type.metric.l` | SF Mono | 24pt | Medium | 28pt | −0.5 | tabular | StatTile primary value |
| `type.metric.m` | SF Mono | 17pt | Medium | 22pt | −0.2 | tabular | Inline metric in a row, GaugeRing centre |
| `type.metric.s` | SF Mono | 13pt | Regular | 17pt | 0 | tabular | Chart axis ticks, table cells, widget secondary |
| `type.body` | SF Pro Text | 17pt | Regular | 22pt | 0 | tabular-lining | Body copy, list row primary |
| `type.bodyEmph` | SF Pro Text | 17pt | Semibold | 22pt | 0 | tabular-lining | Emphasised row, selected item |
| `type.callout` | SF Pro Text | 16pt | Regular | 21pt | 0 | tabular-lining | Explanatory copy in sheets |
| `type.subhead` | SF Pro Text | 15pt | Regular | 20pt | 0 | tabular-lining | List row secondary |
| `type.footnote` | SF Pro Text | 13pt | Regular | 18pt | 0 | tabular-lining | Timestamps in prose, helper text |
| `type.caption` | SF Pro Text | 12pt | Regular | 16pt | +0.1 | tabular-lining | Legend labels, chart subtitle |
| `type.micro` | SF Pro Text | 11pt | Semibold | 14pt | **+0.6** | tabular-lining | **Uppercase** section eyebrows, unit suffixes, StatusPill label |
| `type.mono.body` | SF Mono | 14pt | Regular | 19pt | 0 | tabular | Log body, fingerprint block, diagnostic output |
| `type.mono.term` | SF Mono | 13pt (user 9–20pt) | Regular | 1.30× size | 0 | tabular | Remote Shell cell grid |

**`type.micro` is the system's signature.** Uppercase, 11pt Semibold, +0.6pt tracking, always `text.tertiary`. It is the instrument face-plate label — `CPU`, `SOC TEMP`, `RX / TX`, `LAST SEEN`, `RELAYED`. It never carries a value, only a name, and it never wraps: if it does not fit, the component is too small.

### 3.3 The tabular-figures mandate

**Every digit the user might watch change is monospaced and tabular.** Concretely:

- All `type.metric.*` roles are SF Mono, which is inherently fixed-advance.
- All SF Pro roles that can contain a number carry `.monospacedDigit()` — the "tabular-lining" figures column above. This applies to `type.body`, `type.bodyEmph`, `type.callout`, `type.subhead`, `type.footnote`, `type.caption`, `type.micro`.
- Units are typeset in `type.micro` at `text.tertiary`, separated from the figure by **2pt**, and are **not** monospaced-critical but inherit tabular anyway for consistency.

> **Deviation from the `dataviz` reference, stated explicitly.** The skill's reference instance prescribes *proportional* figures for large standalone numbers (a hero figure, a stat-tile value) because `tabular-nums` makes a display-size `121` look loose, and reserves tabular figures for columns. **This system overrides that for every live-updating readout** and uses tabular throughout, including the hero. The rationale is product-specific and, we believe, decisive here: these numbers update on a 1–5 s cadence while the user is looking at them. With proportional figures a CPU readout stepping `9.4 → 10.1 → 9.8` changes width three times in three seconds, dragging its unit suffix and any trailing delta with it. That reflow is far more damaging to the "precision instrument" read than slightly loose digits, and it violates P-D2 by making a static layout look agitated. The looseness is compensated by the −0.8pt / −1.0pt negative tracking on `type.metric.xl` and `type.hero`. Tabular figures are retained in tables and axis ticks for the reason the skill gives. **Static, never-updating numbers in prose** (a version string, a port number in a sentence) may use proportional figures.

### 3.4 Dynamic Type behaviour

Baseline: **every role scales**, all the way to AX5, unless listed below. Support is `xSmall` → `AX5`.

| Role | Scaling | Cap | Truncation policy |
|---|---|---|---|
| `type.hero` | Scales | **capped at `xxxLarge`** (≈ 1.35×) | Never truncates. Above the cap the value auto-compacts (`1,284` → `1.28K`) and, failing that, the tile grows vertically. |
| `type.display`, `type.title1–3` | Scales | uncapped | Wrap to 3 lines, then tail-truncate. Agent names never truncate — see below. |
| `type.metric.xl / l / m` | Scales | **capped at `AX1`** (≈ 1.6×) | **Never truncates and never compacts below 3 significant figures.** Above `AX1` the containing tile reflows from 2-up to 1-up (§4.3). |
| `type.metric.s` | Scales | capped at `xxxLarge` | Axis ticks thin out (§8.3) rather than shrink or overlap. |
| `type.body`, `bodyEmph`, `callout`, `subhead`, `footnote` | Scales | uncapped | Wrap freely. |
| `type.caption` | Scales | uncapped | Legend labels wrap; the legend becomes a vertical list above `AX2`. |
| `type.micro` | Scales | **capped at `xxLarge`** | **Never truncates, never wraps.** At and above `AX3` the eyebrow moves from beside the value to its own line above it. |
| `type.mono.body` | Scales | uncapped | Horizontal scroll, never wrap (log lines) — except fingerprints, which wrap on group boundaries (§7.12). |
| `type.mono.term` | **Does not follow Dynamic Type.** | — | Terminal font size is a user setting (9–20pt, §7.8) because the terminal is a fixed cell grid and Dynamic Type would resize the PTY on every system change. The setting's default is derived from the user's Dynamic Type category at first launch, once. |

**Must-never-truncate list.** These strings are load-bearing and must always be fully visible, wrapping or scaling their container if necessary:

- The Agent's user-assigned name, anywhere it identifies which machine an Action will hit.
- Any identity fingerprint, hex or word-sequence, in FingerprintVerificationView.
- The full text of a destructive confirmation, including the Agent name and the Action name.
- The numeric value in any StatTile, GaugeRing or MetricChart readout.
- Any error code from [05-PROTOCOL](05-PROTOCOL.md) shown in ErrorState or Diagnostics.

---

## 4. Spacing, grid, radii, elevation

### 4.1 Base scale

4pt base. Named tokens only — a raw number never appears at a call site.

| Token | Value | Use |
|---|---|---|
| `space.0` | 0 | Flush |
| `space.1` | 2pt | Figure↔unit gap; chart surface gap between marks |
| `space.2` | 4pt | Icon↔label in a pill; tightest vertical rhythm |
| `space.3` | 8pt | Intra-component padding; StatTile internal gap |
| `space.4` | 12pt | Card internal padding (compact); gap between tiles |
| `space.5` | 16pt | **Screen margin**; card internal padding (regular) |
| `space.6` | 20pt | Gap between card groups |
| `space.7` | 24pt | Section gap |
| `space.8` | 32pt | Major section gap; above a primary CTA |
| `space.9` | 40pt | Empty-state vertical rhythm |
| `space.10` | 56pt | Top padding of a first-run screen |

### 4.2 Screen metrics

| Metric | Value |
|---|---|
| Screen leading/trailing margin | `space.5` = 16pt |
| Screen margin, Remote Desktop & Remote Shell | 0 (edge to edge) |
| Content max width | 640pt, centred (iPad / Mac Catalyst safety; iPhone never reaches it) |
| Scroll content top inset below nav bar | `space.4` = 12pt |
| Scroll content bottom inset above tab bar | `space.7` = 24pt |
| Gap between stacked cards | `space.4` = 12pt |
| Gap between card groups | `space.6` = 20pt |
| Section header → first card | `space.3` = 8pt |
| Safe-area-respecting bottom bar height | 49pt + safe area |

### 4.3 Grid and card metrics

The Dashboard uses a **2-column tile grid** with 12pt gutters inside the 16pt screen margins. On a 393pt-wide device this yields **172.5pt** tiles.

| Component | Height | Padding | Notes |
|---|---|---|---|
| StatTile (compact) | 96pt | 12pt | Label + value + unit |
| StatTile (with Sparkline) | 120pt | 12pt | Label + value + unit + 32pt sparkline band |
| StatTile (wide, 2-col span) | 120pt | 16pt | Used for network (rx/tx dual value) |
| AgentCard | 88pt | 16pt | Two-line, with StatusPill and 3 mini-metrics |
| MetricChart card | 240pt | 16pt (12pt at the plot edges) | 176pt plot + 24pt x-axis band + 40pt header. **The card height includes the axis band** — never a nested scroll. |
| GaugeRing tile | 120pt | 12pt | Ring Ø 72pt |
| List row (standard) | 44pt min | 16pt h / 12pt v | |
| List row (two-line) | 60pt min | 16pt h / 10pt v | |
| AlertRow | 72pt min | 16pt h / 12pt v | Severity stripe 3pt on the leading edge |
| LogRow | 28pt min, grows | 12pt h / 4pt v | Monospaced, no wrap |

**Reflow rules.** The 2-column grid collapses to 1 column when: Dynamic Type is `AX1` or larger; or the window width is below 340pt. Wide tiles are always full width. A tile never shrinks below 156pt wide — it reflows instead.

### 4.4 Corner radii

Deliberately tighter than iOS defaults. An instrument has milled edges, not pillows.

| Token | Value | Applied to |
|---|---|---|
| `radius.none` | 0 | DesktopViewport content, TerminalSurface content, full-bleed media |
| `radius.xs` | 4pt | Chart mark data-ends, inline code chips, colour swatches |
| `radius.s` | 8pt | Buttons, text fields, segmented control, keyboard accessory keys |
| `radius.m` | 10pt | StatTile, small cards, menu |
| `radius.l` | 12pt | **AgentCard, MetricChart card, sheet content, primary module radius** |
| `radius.xl` | 16pt | Sheet top corners, full-screen cover |
| `radius.pill` | height / 2 | StatusPill, filter chips, time-range presets |

Nested radii follow the concentric rule: inner radius = outer radius − padding, floored at `radius.xs`. A 12pt card with 12pt padding contains 4pt-radius children, not 12pt ones.

### 4.5 Hairlines and border widths

Repeated from §2.3 for the spacing engineer: `border.width.hairline` = 1 physical pixel (`1 / displayScale`), `border.width.regular` = 1pt, `border.width.emphasis` = 2pt. Focus ring = 2pt at 2pt offset, radius = component radius + 2pt.

### 4.6 Elevation

Elevation is expressed by **surface value first, shadow second**. Only three components cast a shadow: sheets, menus/popovers, and the DesktopViewport control overlay.

| Token | Dark | Light | Applied to |
|---|---|---|---|
| `elev.0` | none | none | Cards, tiles, rows — **flat**. Separation comes from `surface.raised` vs `surface.canvas` plus `border.subtle`. |
| `elev.1` | y 2, blur 8, `#000000` @ 40% | y 2, blur 8, `#0D1418` @ 8% | Menus, popovers, tooltips, scrub readout |
| `elev.2` | y 8, blur 24, `#000000` @ 52% | y 8, blur 24, `#0D1418` @ 12% | Sheets, dialogs, DesktopViewport control overlay |
| `elev.scrim` | `#000000` @ 62% | `#0D1418` @ 40% | Behind `elev.2` |

In dark mode, a shadow alone is nearly invisible; every `elev.1`/`elev.2` surface therefore also carries a 1px `border.subtle` top-and-side rim, which is what actually separates it from the ground.

---

## 5. Iconography — SF Symbols

**Rendering:** monochrome by default, tinted by the containing text token. **Hierarchical** rendering for status glyphs at ≥ 20pt. **Palette** rendering for exactly one symbol, `lock.shield` in ConnectionBanner, where the shield takes `text.secondary` and the lock takes `accent.base`. **Multicolour is never used** — it would introduce colours outside this system.

**Weight:** icons match the weight of the text they sit beside (Regular beside `type.body`, Semibold beside `type.bodyEmph`, Medium beside `type.metric.*`). Optical sizes: `.small` under 15pt, `.medium` 15–24pt, `.large` above.

| Concept | Symbol | Notes |
|---|---|---|
| **Connection & Tunnel** | | |
| Tunnel established, direct path | `bolt.horizontal.fill` | `accent.base` |
| Tunnel established, relayed path | `arrow.triangle.branch` | `status.info` — relaying is nominal, not a problem |
| Tunnel connecting / handshaking | `bolt.horizontal` | Non-filled = not yet live |
| Tunnel down, Agent offline | `bolt.horizontal.circle` | `status.offline` |
| State unknown | `questionmark.circle` | `status.unknown`, dashed rim |
| Reconnecting | `arrow.trianglehead.2.clockwise.rotate.90` | Animated only while a retry is genuinely in flight (P-D2) |
| Latency / RTT | `timer` | |
| **Encryption & identity** | | |
| E2EE active, peer verified | `lock.fill` | |
| E2EE active, verification pending | `lock.open.trianglebadge.exclamationmark` | `status.warning` |
| Identity fingerprint | `number` | Beside the hex block |
| Fingerprint word/emoji sequence | `textformat.abc` | |
| Key rotation available/pending | `key.horizontal` | |
| Revoke a paired device | `key.slash` | `status.critical` |
| Biometric re-auth required | `faceid` / `touchid` | Follow device capability |
| Pairing (QR) | `qrcode.viewfinder` | |
| **Metrics** | | |
| CPU utilisation | `cpu` | |
| Per-core detail | `square.grid.3x3` | |
| SoC temperature | `thermometer.medium` | Swaps to `.high` at `thermal.4`, `.low` below `thermal.1` — a *shape* change carrying the same information as the colour, satisfying "never hue alone" |
| Memory | `memorychip` | |
| Swap | `memorychip.fill` | |
| Disk / filesystem | `internaldrive` | |
| Disk I/O | `arrow.up.arrow.down.circle` | |
| Network throughput | `arrow.up.arrow.down` | rx = down arrow leading, tx = up arrow |
| Network interface | `network` | |
| Uptime / load | `gauge.with.dots.needle.bottom.50percent` | |
| Power / voltage / throttle flags | `bolt.badge.clock` | Under-voltage uses `bolt.trianglebadge.exclamationmark`, `status.warning` |
| GPU / video | `display` | |
| Processes | `list.bullet.indent` | |
| **Alerts** | | |
| Info severity | `info.circle.fill` | `status.info` |
| Warning severity | `exclamationmark.triangle.fill` | `status.warning` |
| Critical severity | `exclamationmark.octagon.fill` | `status.critical` |
| Alert resolved | `checkmark.circle.fill` | `status.ok` |
| Alert acknowledged / snoozed | `bell.badge.slash` | `text.tertiary` |
| Alert Rule (editor) | `slider.horizontal.below.square.filled.and.square` | |
| **Surfaces** | | |
| Remote Shell | `apple.terminal` | |
| Remote Desktop | `macwindow.on.rectangle` | |
| Agent / device | `server.rack` | An Agent is a machine, not a phone |
| Multiple Agents | `rectangle.stack` | |
| Actions | `bolt.square` | |
| Destructive Action | `exclamationmark.arrow.trianglehead.2.clockwise.rotate.90` (reboot) / `power` (shutdown) | Always `status.critical` tint |
| Diagnostics / connection inspector | `waveform.path.ecg` | |
| Settings | `gearshape` | |
| Time range | `clock.arrow.circlepath` | |
| Data gap / no data | `minus.diamond` | Used in the chart gap legend |

**When an icon may appear without a label.** Only when **all four** hold:

1. It is in the **tab bar**, a **navigation bar button**, or a **repeated row affordance** whose meaning is established by an adjacent labelled example on the same screen; and
2. it has a VoiceOver label and, where applicable, a value (§9); and
3. it is **not** carrying status — every status glyph is always accompanied by its text label, without exception; and
4. it is **not** the only affordance for a destructive Action.

Everywhere else — StatTile headers, AlertRow severities, ConnectionBanner segments, Action rows — the icon is decoration beside a label and is marked `.accessibilityHidden(true)` so VoiceOver reads the label once.

---

## 6. Motion

### 6.1 Duration and easing tokens

| Token | Duration | Curve | Use |
|---|---|---|---|
| `motion.instant` | 80 ms | `easeOut` | Pressed-state fill, toggle knob |
| `motion.fast` | 140 ms | `easeOut` (0.2, 0, 0, 1) | Pill state change, chip selection, tooltip in |
| `motion.base` | 220 ms | `easeInOut` (0.4, 0, 0.2, 1) | Card expand, list insert/remove, tab content cross-fade |
| `motion.slow` | 320 ms | `easeInOut` | Sheet present/dismiss, screen push |
| `motion.deliberate` | 480 ms | `easeInOut` | Destructive confirm reveal — slow on purpose (P-D5) |
| `motion.spring.ui` | response 0.32, damping 0.86 | spring | Interactive drag release: sheet, scrub handle, Agent switcher |
| `motion.spring.snap` | response 0.22, damping 1.0 | spring, no overshoot | Anything positional near live data — **critically damped, never bouncy** |
| `motion.data` | 180 ms | `linear` | Chart value interpolation between two *received* samples |
| `motion.pulse` | 1200 ms | `easeInOut`, one cycle per event | Liveness tick (§6.3) |

### 6.2 Named transitions

| Transition | Spec |
|---|---|
| Screen push / pop | Standard `NavigationStack` push, `motion.slow`. Large title collapses to inline on scroll at 32pt offset. |
| Sheet present | Slide up + scrim fade, `motion.slow`; detents where used are `.medium` then `.large`. Content fades in at 60% of the slide. |
| Sheet dismiss (drag) | `motion.spring.ui`, follows the finger 1:1, dismiss threshold 40% or velocity > 800 pt/s. |
| Tab change | Cross-fade `motion.base`, **no slide** — sliding implies spatial adjacency the tabs do not have. |
| **Tunnel connecting** | ConnectionBanner height animates 0 → 20pt over `motion.base`. The `bolt.horizontal` glyph does **not** spin; instead the banner's leading 3pt rail fills left→right over the *actual* handshake, driven by real protocol milestones from [05-PROTOCOL](05-PROTOCOL.md) (transport up → handshake sent → handshake complete → first Channel open), never by a timer. If a milestone stalls, the rail stalls with it. |
| **Tunnel established** | Rail completes, then a single 140 ms `accent.base` → `accent.high` → `accent.base` flash on the lock glyph. One flash. No repeat. Haptic: `.success`. |
| **Tunnel disconnected** | Banner recolours to `status.offline` over `motion.fast`, drops its rail instantly (no easing — the connection did not fade, it ended), and every live figure on screen dims to `text.secondary` and gains an age stamp within the same 140 ms. Haptic: `.warning`. |
| **Alert arrival (in-app)** | AlertRow inserts at the top of the list with a 220 ms height + opacity animation and a 900 ms `status.*` @ 14% background wash that decays to clear. The list does **not** auto-scroll if the user is scrolled away from the top; a "1 new alert" chip appears instead. |
| **Chart data update** | New sample: the line extends and the x-window slides by exactly one sample interval over `motion.data` (180 ms, linear). The y-axis rescales only when the incoming value falls outside the current domain, and then over `motion.base` with the gridlines cross-fading — never a continuous rubber-band. |
| **Skeleton → content** | Skeleton cross-fades to content over `motion.base`. No slide, no scale, no stagger. The skeleton's geometry is identical to the content's, so nothing moves. |
| **Refetch (time-range change, pull-to-refresh)** | The existing chart is held at **60% opacity** while the new slice loads. **No skeleton, no layout jump, no flash.** |
| Destructive confirm | Sheet rises over `motion.slow`; the confirm control becomes enabled only after `motion.deliberate` (480 ms) has elapsed *and* the gesture requirement is met (§7.11). |
| Agent switch | Content cross-fades over `motion.base` while the nav title crossfades; charts re-enter as skeletons because the data genuinely is not held yet. |

### 6.3 The liveness rule (hard)

**Motion may only represent an event that occurred.** Enforced as:

- The Dashboard carries exactly **one** liveness indicator: a 6pt dot in ConnectionBanner that runs one `motion.pulse` cycle **per Snapshot received**. At a 5 s telemetry interval it pulses every 5 s. If Snapshots stop, the dot stops — immediately, mid-cycle if necessary — and turns `status.offline`. It is never a looping animation.
- A Sparkline or MetricChart animates **only** when a sample arrives. There is no idle drift, no scrolling time axis between samples, no "breathing".
- A spinner may only be shown while a request is genuinely outstanding. If a request is retrying with backoff, the UI shows the *countdown to the next attempt* as text, not a spinner (`retrying in 4s`).
- Skeletons never shimmer with a moving gradient. `SkeletonLoader` is a static `surface.raised2` block at 100% opacity with a 1200 ms opacity oscillation between 100% and 72%. A moving highlight implies streaming progress that does not exist. Under Reduce Motion the oscillation is removed entirely and the block is static.
- The Remote Desktop viewport never shows a synthetic "last frame with a blur". If frames stop, the last frame is held at 45% opacity under a `status.warning` overlay reading `Video stalled · 3s`. See §7.9.

### 6.4 Reduce Motion

When `accessibilityReduceMotion` is on:

| Default | Reduce Motion replacement |
|---|---|
| Screen push / pop | Cross-fade, `motion.base` |
| Sheet present / dismiss | Cross-fade + 8pt vertical offset, `motion.base` |
| Tab cross-fade | Retained (already a fade) |
| ConnectionBanner rail fill | Discrete: the rail jumps between the four handshake milestone positions with no interpolation |
| Tunnel-established flash | Removed. A single `.success` haptic remains. |
| Alert arrival | No height animation; the row appears. The background wash becomes a static 900 ms hold then instant clear. |
| Chart data update | **No interpolation.** The line and the x-window jump one sample interval. This is arguably *more* honest and is offered as a general setting too (Settings → Appearance → `Animate chart updates`, default on, forced off under Reduce Motion). |
| Y-axis rescale | Instant |
| Skeleton oscillation | Removed; static block |
| Liveness dot pulse | Replaced by a **discrete state change**: the dot renders filled for 400 ms on each Snapshot, then hollow. No opacity ramp. |
| Refetch opacity hold | Retained (opacity change, not motion) |
| Parallax / large-title collapse | Large title switches to inline immediately at scroll offset > 0 |
| Destructive confirm reveal | Timing retained (480 ms is a deliberate gate, not decoration), but as a fade |

`accessibilityReduceTransparency`: all materials (keyboard accessory bar, DesktopViewport overlay) become opaque `surface.raised2` with `border.subtle`.

---

## 7. Component library

Every component below lists anatomy, states, sizes and tokens. States are the full set: **default, highlighted** (pointer hover on iPad/Mac/Vision), **pressed, focused, selected, loading, empty, error, disabled**. Where a state is not applicable it is marked n/a with a reason.

### 7.1 StatusPill

The atom of P-D1. Communicates one of the six §2.6 states.

**Anatomy** (leading → trailing): 6pt status dot or glyph · `space.2` 4pt · `type.micro` uppercase label · optional `space.2` + 11pt trailing detail in `text.tertiary`.

```
┌──────────────────────┐
│ ● ONLINE · 34ms      │   height 22pt, radius.pill, padding 8/4
└──────────────────────┘
```

| Size | Height | H padding | Dot | Label |
|---|---|---|---|---|
| `compact` | 18pt | 6pt | 5pt | `type.micro` 10pt |
| `regular` | 22pt | 8pt | 6pt | `type.micro` 11pt |
| `large` | 28pt | 12pt | 8pt | `type.caption` 12pt Semibold |

| State | Rendering |
|---|---|
| default (ok / info / warning / critical) | Fill = status token @ 14%; ink = status token; dot = status token solid. No border. |
| default (offline) | Fill = `status.offline` @ 12%; ink and dot = `status.offline`, solid dot. |
| default (unknown) | **No fill.** 1pt **dashed** `status.unknown` border, hollow dot, ink `status.unknown`. The dashed rim is what distinguishes it from offline without relying on the ΔE 5.8 hue difference. |
| highlighted | Fill @ 20% |
| pressed | Fill @ 26%, scale 0.97, `motion.instant` — only when the pill is itself a control (it is tappable on AgentCard, opening Diagnostics) |
| focused | 2pt `border.focus` ring at 2pt offset |
| loading | Label reads `CONNECTING`, ink `text.tertiary`, dot hollow with the 4-milestone rail (§6.2) as a 2pt underline |
| disabled | n/a — a status is never disabled |
| error | Rendered as `critical` with the error's short code appended as trailing detail (`● FAILED · E-0412`) |

**Never** render a StatusPill as a bare coloured dot with no label.

### 7.2 AgentCard

One paired Agent, at a glance. Used on the Agent list and in the Agent switcher.

```
┌─────────────────────────────────────────────────┐
│ ● ONLINE · direct · 34ms          🔒       ›     │  ← StatusPill + lock + chevron
│ pi5-livingroom                                  │  ← type.title3, never truncates
│ CPU  12%   SOC  54°C   MEM  38%   UP 14d        │  ← type.micro labels + type.metric.m values
└─────────────────────────────────────────────────┘
   88pt tall · radius.l 12pt · surface.raised · border.subtle 1pt
```

**Anatomy:** row 1 = StatusPill (leading) + lock glyph + disclosure chevron (trailing); row 2 = Agent name (`type.title3`, `text.primary`); row 3 = three-to-four inline micro-metrics, each `type.micro` label above/beside a `type.metric.m` value, evenly distributed.

| State | Rendering |
|---|---|
| default | As above |
| highlighted | `surface.raised2` |
| pressed | `surface.raised2`, scale 0.985, `motion.instant` |
| focused | 2pt `border.focus` |
| selected (current Agent in switcher) | 2pt `accent.base` border + `accent.wash` fill + a filled 3pt leading rail |
| loading (never contacted this launch) | StatusPill = `unknown`; metric values replaced by `SkeletonLoader` bars 44×14pt; name shown (it is cached and known) |
| empty | n/a — an AgentCard always represents a real paired Agent |
| error (last connection attempt failed) | StatusPill = `critical` with code; row 3 replaced by the error's one-line message in `status.critical`, `type.subhead`; a `Retry` ActionButton (tertiary) appears trailing |
| offline | StatusPill = `offline`; metric values are the **last known** values dimmed to `text.secondary`, each followed by a `type.micro` age stamp (`54°C · 6m`) |
| disabled | n/a |

### 7.3 StatTile

The Dashboard's primary unit. One metric.

```
┌───────────────────────┐   ┌───────────────────────┐
│ CPU              ⌃    │   │ SOC TEMP         🌡   │  ← type.micro + optional icon
│                       │   │                       │
│ 12.4 %                │   │ 54.2 °C               │  ← type.metric.l + unit in micro
│ ▁▂▃▂▁▂▄▃▂▁▂▃          │   │ ▂▂▃▃▄▄▅▄▄▃▃▂          │  ← Sparkline 32pt band
└───────────────────────┘   └───────────────────────┘
  172.5 × 120pt · radius.m 10pt · surface.raised · padding 12pt
```

**Anatomy:** eyebrow (`type.micro`, `text.tertiary`, uppercase, never truncates) · optional trailing 13pt glyph · value (`type.metric.l`, `text.primary`, tabular) · unit (`type.micro`, `text.tertiary`, 2pt after the figure, baseline-aligned) · optional delta (`type.caption`, signed, coloured by *direction × whether up is good*, with an arrow glyph so the sign is not colour-only) · optional 32pt Sparkline band.

| State | Rendering |
|---|---|
| default | As above. Value `text.primary`. |
| highlighted / pressed | `surface.raised2` / + scale 0.985 |
| focused | 2pt `border.focus` |
| selected | n/a |
| loading (first fetch) | SkeletonLoader: 40×10pt eyebrow bar, 92×24pt value bar, 148×24pt sparkline bar. Same geometry as content, so nothing moves on arrival. |
| refreshing (data held) | Content at 60% opacity, **no skeleton** |
| empty (Series exists, no samples in range) | Value renders as `—` in `text.tertiary` at `type.metric.l`; unit still shown; sparkline replaced by a full-width hatched gap band with the caption `no data` |
| error (Series fetch failed) | Value `—`; a 13pt `exclamationmark.triangle.fill` in `status.warning` replaces the trailing glyph; caption row shows the short error; whole tile remains tappable to retry |
| offline / stale | Value dimmed to `text.secondary`, `type.micro` age stamp replaces the delta (`4m ago`), sparkline drawn in `de-emphasis` grey with a hatched gap from the disconnection point to now |
| disabled | n/a |

**Thermal tiles** additionally tint the value's *unit* and the sparkline's endpoint dot with the thermal step, never the figure itself (§2.7).

### 7.4 Sparkline

A 12-to-60 point trend inside a tile or widget. **Not** a chart: no axes, no gridlines, no labels, no tooltip.

| Property | Value |
|---|---|
| Band height | 32pt in a StatTile, 20pt in a list row, 16pt in `accessoryRectangular` |
| Stroke | 2pt, round join/cap, `viz.series.1` (or the metric's thermal step for temperature) |
| Area fill | Series hue @ **10%**, from the line to the band floor. A wash, never a block. |
| Endpoint | 8pt dot (r 4) in `accent.high`, with a **2pt `surface.raised` ring** so it stays legible over the fill |
| Domain | Fixed to the tile's stated window (default 1 h). The y-domain is the window's min/max padded 8%, **not** 0-based — a sparkline shows shape, and the tile's figure shows level. |
| Baseline | None. |
| Threshold | If an Alert Rule threshold falls inside the y-domain, a 1pt `status.warning`/`status.critical` horizontal rule is drawn at 50% opacity. No label. |
| **Gaps** | **A gap is never interpolated.** Where samples are missing, the stroke stops, the area fill stops, and the gap region is filled with the 45° hatch in `viz.gap` at 1pt/4pt pitch. See §8.6. |
| Empty | Full-width hatch band + `type.micro` caption `NO DATA` centred |
| Reduce Motion | Redraws discretely on each sample; no interpolation |
| Accessibility | `.accessibilityHidden(true)` — the parent StatTile carries the value and the trend in its accessibility value (§9) |

### 7.5 GaugeRing

A single ratio against a limit. Used for disk fill, memory fill, and the Remote Desktop bitrate budget.

```
        ╭───────╮
      ╱           ╲
     │    38 %     │      ring Ø 72pt, stroke 8pt, gap at bottom 60°
      ╲   USED    ╱       centre: type.metric.m + type.micro
        ╰───────╯
```

| Property | Value |
|---|---|
| Diameter | 72pt (tile), 44pt (row), 120pt (detail) |
| Stroke | 8pt (tile), 5pt (row), 12pt (detail), round cap on the fill, butt cap on the track |
| Sweep | 300°, starting at 210° (bottom-left), gap at the bottom so the reading is never occluded by the centre label |
| Track | `viz.sequential.100` (light) / `viz.sequential.700` (dark) — **a lighter/darker step of the fill's own ramp**, so state reads across the whole ring |
| Fill | `viz.sequential.500` under the first threshold; `status.warning` between thresholds; `status.critical` above |
| Threshold ticks | 2pt radial ticks in `border.strong` at each Alert Rule threshold, drawn **outside** the ring |
| Centre | value `type.metric.m` + `type.micro` uppercase caption |
| Loading | Track only, centre `—`; **no rotating arc** |
| Empty | Track only, centre `—`, caption `NO DATA` |
| Error | Track in `border.strong`, centre `!` glyph in `status.warning` |
| Disabled | Track and centre at `text.disabled` |
| Reduce Motion | Fill jumps to the new value; no sweep animation |

### 7.6 MetricChart

The full chart component. Anatomy and behaviour are specified in §8; this entry covers the container.

```
┌──────────────────────────────────────────────────────┐
│ SOC TEMPERATURE                    ⌄ 6h    ⋯          │ 40pt header
│ 54.2 °C  now                                          │
│ 100 ┤                                                 │
│     ┤                        ╭─╮                      │ 176pt plot
│  80 ┼ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┼─┼─ ─ ─ ─  throttle     │ ← threshold, dashed
│     ┤       ╭──╮   ▓▓▓▓▓  ╭──╯ ╰──╮                   │ ← ▓ = gap hatch
│  40 ┤ ──────╯  ╰───▓▓▓▓▓──╯       ╰────                │
│     └──┬──────┬──────┬──────┬──────┬──                │ 24pt axis band
│      12:00  13:00  14:00  15:00  16:00                │
└──────────────────────────────────────────────────────┘
  240pt total · radius.l · surface.raised · padding 16pt
```

| State | Rendering |
|---|---|
| default | As above |
| scrubbing | Vertical `text.secondary` 1pt crosshair snapped to the nearest sample; readout replaces the header's "now" value; endpoint dot moves to the scrubbed sample |
| loading | Skeleton: header bars + a 176pt `surface.raised2` block with 4 hairline gridlines already drawn at the final positions |
| refetching (range change) | Previous render held at 60% opacity; header range chip shows a 2pt `accent.base` progress underline |
| empty | Plot area shows a centred `EmptyState` (§7.14) sized to the plot, message `No samples in this range` + a `Widen range` ActionButton |
| partial | Rendered normally with explicit hatched gaps; a `type.caption` note under the axis: `2 gaps · 14 min missing` |
| error | Plot replaced by `ErrorState` (§7.15) sized to the plot; header and range control remain usable |
| offline | Chart renders cached data with a trailing hatched gap running from the disconnection to now, plus a `status.offline` StatusPill in the header |
| disabled | n/a |

### 7.7 LogRow

One line of Agent log or diagnostic output.

```
14:32:07.412  WARN   agent::telemetry   sample interval overrun 5.4s
└─ ts ──────┘ └lvl─┘ └─ target ───────┘ └─ message ──────────────────
```

| Property | Value |
|---|---|
| Height | 28pt min, grows for wrapped detail (collapsed by default) |
| Font | `type.mono.body` 14pt |
| Timestamp | `text.tertiary`, tabular, fixed 96pt column |
| Level | `type.micro` uppercase, fixed 48pt column, coloured: TRACE/DEBUG `text.tertiary`, INFO `text.secondary`, WARN `status.warning`, ERROR `status.critical`. **Plus** a 3pt leading severity stripe for WARN and above, so level is not colour-only. |
| Target/module | `text.tertiary`, truncates head-first (`…::telemetry`) |
| Message | `text.primary`, **no wrap**; the row scrolls horizontally as part of a shared horizontal scroll for the whole log view so columns stay aligned |
| Expanded | Tap toggles: message wraps, structured fields render as `key=value` pairs in `type.caption`, `text.secondary` |
| default / highlighted / pressed | — / `surface.raised2` / `surface.raised2` |
| focused | 2pt `border.focus` inset 2pt |
| selected | `accent.wash` background; long-press or focus + menu offers Copy |
| loading | 3 skeleton rows |
| empty | `EmptyState`: `No log lines in this range` |
| error | `ErrorState` replacing the list |
| disabled | n/a |

### 7.8 TerminalSurface

The Remote Shell's rendering surface. A fixed cell grid, not a text view.

| Property | Value |
|---|---|
| Ground | `surface.sunken` `#06090B` in both appearances by default (§2.2 exception) |
| Font | SF Mono, user-set 9–20pt (default 13pt), line height 1.30× |
| Cell metrics | Advance = SF Mono advance at the chosen size; the PTY is resized (`SIGWINCH` over the `shell` Channel) whenever cols/rows change |
| Colours | §2.9 ANSI 16 + 256 + truecolour passthrough |
| Cursor | §2.9 |
| Selection | `accent.base` @ 24%, extended by long-press + drag with magnifier |
| Scrollback | 10 000 lines default (Settings), rendered lazily |
| Padding | 8pt leading/trailing, 4pt top, 0 bottom (the accessory bar abuts) |
| Bell | Never audible. A 140 ms `accent.base` @ 20% full-surface flash, suppressed entirely under Reduce Motion, where a 200 ms `status.info` 2pt top rule is shown instead |
| default | Live PTY, cursor visible |
| loading | Ground + a single centred `type.mono.body` line: `opening shell…` in `text.tertiary`. No spinner. |
| empty | n/a — a PTY always has a prompt |
| error | Existing scrollback is **retained and dimmed to 60%**, with a `ConnectionBanner`-styled strip pinned to the bottom of the surface: `Shell channel closed · E-0530 · Reconnect`. Never clear the buffer on error. |
| disabled (session ended by the Agent) | Buffer retained at 60%, cursor removed, accessory bar replaced by a single `Start new session` ActionButton |
| focused | Keyboard attached; a 2pt `accent.base` rule along the surface's bottom edge indicates key capture is active |

**Keyboard accessory bar** is specified in [07-UX-SPEC](07-UX-SPEC.md) §Remote Shell; its keys use `radius.s`, `surface.raised2`, `border.subtle`, `type.mono.body` 14pt, 44×36pt minimum, 6pt gaps.

### 7.9 DesktopViewport

The Remote Desktop surface plus its on-screen control overlay.

```
┌───────────────────────────────────────────────┐
│▓▓▓▓▓▓▓▓▓▓▓ letterbox #000000 ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│
│┌─────────────────────────────────────────────┐│
││                                             ││
││          live Wayland framebuffer           ││
││                                             ││
│└─────────────────────────────────────────────┘│
│▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│
│  ╭──────────────────────────────────────╮     │
│  │ ⌨  ⌘ ⌃ ⌥ ⇧  ⇥ ⎋  │ ▣ ptr │ ◐ 4.2Mb/s │     │ ← overlay, elev.2
│  ╰──────────────────────────────────────╯     │
└───────────────────────────────────────────────┘
```

| Property | Value |
|---|---|
| Content radius | `radius.none` — the framebuffer is never rounded; rounding would crop real pixels |
| Letterbox | `#000000` (the one sanctioned pure black — it is genuinely absent signal) |
| Scaling | Aspect-fit by default; pinch-zoom 1.0×–4.0×, pan when zoomed. Zoom level persists per Agent. |
| Overlay | Floating pill, `elev.2`, `.regularMaterial` (opaque `surface.raised2` under Reduce Transparency), `radius.pill`, 44pt tall, 16pt above the safe area, draggable to top or bottom, auto-hides after 4 s of no input and returns on any tap |
| Overlay contents | modifier-key toggles (⌘⌃⌥⇧, each a 36×36pt latching toggle showing `accent.wash` when latched), ⇥ and ⎋ momentary keys, a keyboard-summon button, a pointer-mode selector, and a live bitrate readout (`type.metric.s`, tabular) |
| Pointer modes | `trackpad` (relative, default) · `direct` (absolute, tap = click at that point) · `pen` (absolute, hover supported with Apple Pencil). Mapping table in [07-UX-SPEC](07-UX-SPEC.md). |
| default | Live frames; overlay auto-hidden |
| loading (negotiating) | Letterbox ground + centred 44pt `SkeletonLoader` block at the target aspect ratio + `type.callout` `Negotiating video…` + the four-milestone rail |
| **stalled** | Last frame held at **45% opacity**, a `status.warning` strip across the top of the content area reading `Video stalled · Ns`, N counting real elapsed seconds. **No blur, no freeze-frame fake, no spinner over the frame.** |
| reconnecting | As stalled, plus the strip becomes `status.info` and reads `Reconnecting · attempt 2 · next try in 4s` |
| error | Content replaced by `ErrorState` on the letterbox ground; overlay hidden except the close button |
| degraded (relayed path / low bitrate) | A persistent `status.info` chip in the overlay: `RELAYED · 480p · 12fps`. Quality is never silently reduced — the chip states the current profile. |
| empty / disabled | n/a |

### 7.10 ConnectionBanner

A 20pt strip pinned under the navigation bar on every screen that depends on a Tunnel. Always present when a Tunnel exists or is expected.

```
│ ⚡ DIRECT · 34ms · 🔒 verified          ● │  20pt, surface.raised, hairline bottom
```

**Anatomy:** path glyph + `type.micro` path label · `·` · RTT (`type.metric.s`, tabular) · `·` · lock glyph + verification word · trailing 6pt liveness dot (§6.3). Tapping opens Diagnostics.

| State | Ink | Content |
|---|---|---|
| direct, verified | `text.secondary`, glyph `accent.base` | `DIRECT · 34ms · 🔒 verified` |
| relayed, verified | `status.info` | `RELAYED · 128ms · 🔒 verified` — relaying is informational, never a warning |
| connecting | `text.tertiary` | `CONNECTING` + the 4-milestone 2pt rail across the banner's full width |
| reconnecting | `status.info` | `RECONNECTING · attempt 3 · next try 8s` |
| offline | `status.offline` | `OFFLINE · last seen 14:22` |
| unknown | `status.unknown` | `NOT CONTACTED` |
| verification pending | `status.warning` | `DIRECT · 34ms · ⚠︎ unverified — Verify now ›` — the whole banner becomes a tap target to FingerprintVerificationView |
| **key mismatch** | `status.critical`, banner grows to 44pt | `⛔️ IDENTITY CHANGED — do not enter credentials. Review ›`. This is the one banner state that is not dismissible and that blocks Remote Shell and Remote Desktop entry until resolved. See [04-SECURITY-E2EE](04-SECURITY-E2EE.md). |
| error | `status.critical` | `FAILED · E-0412 · Retry ›` |
| loading / empty / disabled | n/a | |

### 7.11 ActionButton

| Variant | Fill | Ink | Border | Height | Use |
|---|---|---|---|---|---|
| `primary` | `accent.base` | `text.onAccent` | none | 50pt | The one forward action on a screen |
| `secondary` | `accent.wash` | `accent.base` | 1pt `accent.base` @ 40% | 44pt | Alternative actions |
| `tertiary` | none | `accent.base` | none | 44pt | Inline, in-row |
| `destructive` | `status.critical` @ 14% | `status.critical` | 1pt `border.destructive` | 50pt | Reboot, shutdown, revoke, unpair, delete Alert Rule |
| `destructiveConfirm` | `status.critical` | `text.onCritical` | none | 50pt | Only inside a confirmation sheet |

Radius `radius.s` 8pt; horizontal padding `space.5`; label `type.bodyEmph` + optional leading glyph at `space.3`; minimum hit target 44×44pt regardless of visual height.

| State | Rendering |
|---|---|
| default | As table |
| highlighted | Fill → `accent.high` (primary) / wash @ 18% (secondary) |
| pressed | Fill → `accent.pressed`; scale 0.98 over `motion.instant`; haptic `.impact(.light)` |
| focused | 2pt `border.focus` at 2pt offset |
| loading | Label replaced by a 16pt indeterminate indicator **and** the label text changed to the present participle (`Rebooting…`); button stays the same width (tabular + reserved width prevents reflow); disabled to further taps |
| disabled | Fill `surface.raised2`, ink `text.disabled`, no border. A disabled ActionButton **must** be accompanied by a `type.footnote` reason beneath it — never a silently dead control. |
| empty / error / selected | n/a |

**Destructive-confirm pattern.** A `destructive` button never performs its Action. It presents a sheet containing: the Action name, the **Agent name in full** (`type.title3`, never truncated), a plain-language consequence line, the expected downtime, and a **slide-to-confirm** track (`destructiveConfirm` fill, 50pt, drag ≥ 80% of track width). The track is inert for the first **480 ms** (`motion.deliberate`). Completing the slide triggers biometric re-authentication (§ [07-UX-SPEC](07-UX-SPEC.md) biometric policy) before the Action is sent over the `control` Channel. Haptics: `.impact(.rigid)` at slide start, `.warning` at completion, `.success`/`.error` on the Agent's acknowledgement.

### 7.12 FingerprintVerificationView

The out-of-band comparison surface for pairing and re-verification. This is the highest-stakes screen in the product ([04-SECURITY-E2EE](04-SECURITY-E2EE.md), README P3).

```
┌───────────────────────────────────────────┐
│  Compare these on the Pi's screen          │  type.title2
│                                            │
│  ╭──────────────────────────────────────╮  │
│  │  9F2C  4A81  D30E  77B5              │  │  type.mono.body 20pt,
│  │  1CE4  8802  6BAF  D915              │  │  grouped 4, 4 per line
│  ╰──────────────────────────────────────╯  │  surface.sunken, radius.s
│                                            │
│  ╭──────────────────────────────────────╮  │
│  │  anchor · velvet · piston · marina   │  │  word sequence,
│  │  cobalt · thistle                    │  │  type.title3, text.primary
│  ╰──────────────────────────────────────╯  │
│                                            │
│  These characters come from the Pi's own   │  type.callout, text.secondary
│  key. They will look the same on the Pi     │
│  and here — and different if anything is    │
│  intercepting the connection.               │
│                                            │
│  [ They match ]        [ They don't match ] │  primary / destructive
└───────────────────────────────────────────┘
```

| Property | Value |
|---|---|
| Hex block | `type.mono.body` at **20pt** (an intentional up-size from 14pt — this is read aloud and compared character by character), grouped in 4s with `space.3` between groups and `space.2` between lines, `text.primary` on `surface.sunken`, `radius.s`. **Never truncates; wraps only on group boundaries.** |
| Word sequence | `type.title3`, `text.primary`, `·`-separated in `text.tertiary`. Present because comparing six words aloud is far more reliable than comparing 32 hex characters. |
| Emoji sequence | Optional third representation, 28pt, shown when Settings → Security → `Show emoji fingerprint` is on |
| Copy affordance | Long-press the hex block copies it; a toast confirms. Copy is **not** offered for the word sequence (it must be spoken/compared, not pasted). |
| Confirm | `They match` = `primary`. **Requires biometric authentication** before the trust record is written. |
| Reject | `They don't match` = `destructive`; leads to a `status.critical` explainer and aborts pairing. No "try again" — a mismatch is a security event, logged per [04-SECURITY-E2EE](04-SECURITY-E2EE.md). |
| default | As above |
| loading | Skeleton blocks at the exact hex/word geometry while the Agent's static key is fetched |
| error (key fetch failed) | `ErrorState`; **no partial fingerprint is ever shown** |
| empty / disabled / selected | n/a |
| re-verification variant | Adds a leading `status.warning` banner: `This Pi's key changed on 14 Mar.` and shows **both** the old and new fingerprints in a diff layout, with changed groups in `status.critical` |

### 7.13 AlertRow

```
┃ ▲ CRITICAL   SOC temp above 80 °C            2m │
┃   pi5-livingroom · held 90s · now 83.4 °C       │   72pt, 3pt leading stripe
```

**Anatomy:** 3pt leading severity stripe (full row height) · severity glyph + `type.micro` severity label · rule name (`type.bodyEmph`) · trailing relative age (`type.metric.s`, tabular, `text.tertiary`) · second line: Agent name · dwell · current value, all `type.subhead`/`type.metric.s`, `text.secondary`.

| State | Rendering |
|---|---|
| firing | Stripe + glyph + label in the severity token; `surface.raised` |
| firing, unread | Additionally a 6pt `accent.base` dot at the leading edge, before the stripe |
| resolved | Stripe → `status.ok` at 50%; glyph `checkmark.circle.fill`; rule name `text.secondary`; a trailing `resolved 14:31` |
| acknowledged / snoozed | Stripe at 30%; `bell.badge.slash` glyph appended; row ink `text.tertiary` |
| arriving | 900 ms severity-token @ 14% background wash decaying to clear (§6.2) |
| highlighted / pressed | `surface.raised2` / + 0.985 scale |
| focused | 2pt `border.focus` |
| selected | `accent.wash` |
| loading | 4 skeleton rows |
| empty | Handled by the list's `EmptyState` |
| error | n/a at row level |
| disabled (rule disabled while alert open) | Ink `text.tertiary`, `slash.circle` glyph appended, stripe at 20% |

Swipe actions: leading = Acknowledge (`status.info`); trailing = Snooze 1 h (`text.tertiary`), Mute rule (`status.warning`). Deleting an Alert is not offered — history is authoritative ([06-DATA-MODEL](06-DATA-MODEL.md)).

### 7.14 EmptyState

| Property | Value |
|---|---|
| Layout | Centred column, max width 300pt: 32pt SF Symbol (`text.tertiary`) · `space.5` · title `type.title3` `text.primary` · `space.3` · body `type.callout` `text.secondary`, ≤ 3 lines · `space.7` · optional single `secondary` ActionButton |
| Vertical placement | Optically centred in its container at 45% height, not 50% |
| Tone | States what is true and what the user can do. Never apologises, never uses "Oops". |
| Variants | `no-agents`, `no-alerts`, `no-samples-in-range`, `no-actions-configured`, `no-log-lines`, `no-paired-devices`, `search-no-results` |

Copy for every variant lives in [07-UX-SPEC](07-UX-SPEC.md) §Microcopy so that empty, error and security strings are reviewed as one voice.

### 7.15 ErrorState

| Property | Value |
|---|---|
| Layout | As EmptyState, plus: a `type.mono.body` error code chip (`surface.sunken`, `radius.xs`, 6pt padding) beneath the body, and a `primary` Retry button |
| Glyph | `exclamationmark.triangle` in `status.warning` for recoverable; `exclamationmark.octagon` in `status.critical` for terminal |
| Code chip | The [05-PROTOCOL](05-PROTOCOL.md) error code, always shown, always copyable, always exactly as the protocol emitted it |
| Body | One sentence on what happened, one on what to do. Never a raw exception string as the body — that goes in Diagnostics. |
| Retry | Shows the backoff countdown as text when auto-retry is scheduled (`Retrying in 6s`), and becomes `Retry now` after the first manual tap |
| Inline variant | 44pt single-line row: glyph + message + trailing `Retry`, used inside cards where a full state would be disproportionate |

### 7.16 SkeletonLoader

| Property | Value |
|---|---|
| Fill | `surface.raised2` (dark) / `surface.sunken` (light) |
| Radius | Matches the content it stands in for; text bars use `radius.xs` |
| Geometry | **Identical to the content's final geometry.** A skeleton that is a different size than its content causes a layout jump on arrival and is a defect. |
| Animation | Opacity oscillation 100% ↔ 72%, 1200 ms, `easeInOut`. **No moving gradient sweep** (§6.3). |
| Reduce Motion | Static at 86% opacity |
| When **not** to use | Any refetch of data already held — that uses the 60% opacity hold instead. Skeletons appear only when the Client genuinely has nothing. |
| Accessibility | Container is `.accessibilityLabel("Loading")` with `.updatesFrequently` traits suppressed; individual bars are hidden |

---

## 8. Data-visualisation specification

Applies the `dataviz` method. Every rule below is a consequence of the procedure in §2.1; where this system diverges from the skill's reference instance, the divergence is called out and justified.

### 8.1 Chart-type selection heuristic

Decide **form before colour**. The first question is always *is it even a chart?*

| Metric / question | Form | Colour job | Why not something else |
|---|---|---|---|
| `cpu.util_pct` — current | **StatTile + Sparkline** | slot 1 | A one-bar bar chart is never right |
| `cpu.util_pct` — over time | **Area chart**, single Series | slot 1, 10% fill | Single Series ⇒ area reads level better than a bare line |
| `cpu.util_pct` per core, ≤ 8 cores | **Multi-line**, one line per core | categorical slots 1..N | Stacking would imply the cores sum to something meaningful |
| `cpu.util_pct` per core, > 8 cores | **Heatmap** (core × time) | sequential cyan | Never a ninth hue |
| `cpu.load_avg` 1/5/15 | **Multi-line**, 3 Series | slots 1–3 | All-pairs safe at three |
| `soc.temp_c` — over time | **Line + threshold rules**, mark colour by thermal step | semantic heat (§2.7) | The user's mental model is a temperature, not a rank |
| `mem.used_bytes` / total | **GaugeRing** (current) + **stacked area** (over time: used / cache / free) | sequential for the ring; slots 1–3 for the stack | Part-to-whole over time ⇒ stacked area |
| `disk.used_bytes` per filesystem | **Horizontal bar**, one bar per mount, all slot 1 | slot 1 for every bar | Nominal categories ⇒ one colour. Never a value ramp across mounts. |
| `disk.io_bps` read/write | **Mirrored area** about a zero baseline | diverging (read below, write above) | Two measures, same unit, opposite direction ⇒ one axis, mirrored |
| `net.rx_bps` / `net.tx_bps` | **Mirrored area** about zero | slot 1 (rx) / slot 2 (tx) | **Never a dual axis.** Same unit, so one axis works. |
| `net.rx_bps` vs `disk.io_bps` (different units) | **Two stacked charts**, shared x and shared scrub | each slot 1 in its own chart | The dual-axis anti-pattern in its most tempting form |
| Uptime | **Hero figure** in a StatTile | no colour | It is a number |
| Throttle flags over time | **Event strip** — a 12pt band of coloured segments under the temperature chart | status tokens (it means bad) | Not a line; it is categorical state over time |
| Alert history by severity | **Stacked column per day** | status tokens | The Series *mean* severity, so they wear status, not categorical |
| Tunnel path over a session | **Event strip**, direct / relayed / down | `accent`, `status.info`, `status.offline` | |
| Distribution of sample intervals (Diagnostics) | **Histogram**, all slot 1 | slot 1 | |
| Latency percentiles p50/p95/p99 | **Multi-line**, 3 Series | slots 1–3 | |
| Anything with > 7 meaningful classes | **Table** (optionally table + chart) | text tokens | Past ~7 bins adjacent classes blur |

**Emphasis is the most underused form here.** When the story is "core 3 is pegged and the others are fine", the chart is *not* eight categorical lines — it is core 3 in slot 1 and the other seven in `viz.deemphasis` grey. Offer this as the default rendering of the per-core chart when exactly one core exceeds 90% while the mean is below 40%.

### 8.2 Axes, grid, frame

| Rule | Spec |
|---|---|
| Axes | One y-axis. **Never two.** |
| Y domain | 0-based for bounded ratios (%, fill). Min/max-padded (8% headroom) for unbounded values (temperature, throughput, latency). Never inverted. |
| Y domain stability | The domain is recomputed only on range change or when an incoming sample falls outside it. A live chart whose y-axis moves every sample is unreadable. |
| Gridlines | Horizontal only, **solid 1pt hairline**, `viz.grid`, at each labelled tick. Never dashed. No vertical gridlines — the crosshair does that job on demand. |
| Baseline | Drawn in `viz.axis` at y = 0 (or at the diverging midpoint), 1pt, solid, one step stronger than the gridlines |
| X-axis rule | Present, `viz.axis`, 1pt |
| Frame | No box. The plot is bounded by the baseline and the axis rule only. |
| Tick labels | `type.metric.s` (SF Mono 13pt, tabular), `viz.tickLabel` = `text.tertiary` |
| Y tick values | Rounded to clean numbers, thousands-separated, unit shown once on the topmost tick only (`100 %`, then `80`, `60`, …) |
| Card height | **Includes the x-axis band.** A 240pt MetricChart is 40pt header + 176pt plot + 24pt axis. A chart card never produces a nested vertical scroll. |

### 8.3 Tick density

| Chart width | Y ticks | X ticks |
|---|---|---|
| ≤ 200pt (tile-embedded) | 2 (min, max) | 2 (start, end) |
| 200–360pt | 3 | 4 |
| 360–560pt | 4 | 5 |
| > 560pt | 5 | 6 |

X labels **thin out, never rotate and never shrink**: if adjacent labels would come within 12pt of each other, drop every other label until they clear. Under Dynamic Type ≥ `AX1`, drop to the smallest count in the table. A dropped tick keeps its gridline.

**X-label format by range** — never longer than necessary:

| Range | Format | Example |
|---|---|---|
| ≤ 1 h | `HH:mm` | `14:32` |
| ≤ 24 h | `HH:mm` | `14:00` |
| ≤ 7 d | `EEE HH:mm` | `Tue 14:00` |
| ≤ 90 d | `d MMM` | `14 Mar` |
| > 90 d | `MMM yyyy` | `Mar 2026` |

### 8.4 Time-range presets

One control row, **above** the charts it scopes, left-aligned, horizontally scrollable chips. **Never inside a chart card, never per-chart.** Changing the range re-renders every chart, tile and table on the screen against the same slice, so the numbers always agree.

| Preset | Window | Resolution served ([06-DATA-MODEL](06-DATA-MODEL.md) Rollup tier) |
|---|---|---|
| `15m` | 15 minutes | raw |
| `1h` (default on Dashboard) | 1 hour | raw |
| `6h` | 6 hours | 1-minute Rollup |
| `24h` | 24 hours | 1-minute Rollup |
| `7d` | 7 days | 5-minute Rollup |
| `30d` | 30 days | 1-hour Rollup |
| `Custom…` | user-picked | best available |

Chip: `radius.pill`, 30pt tall, `type.micro`; unselected `surface.raised2` + `border.subtle`; selected `accent.wash` + 1pt `accent.base` + `accent.base` ink. The active Rollup tier is stated in `type.caption` `text.tertiary` beneath the row (`1-minute averages`) so the user is never guessing at resolution — this matters when reading a spike that was averaged away.

### 8.5 Tooltip and scrub interaction

The touch analogue of the hover layer. It is part of the deliverable, not an upgrade.

| Rule | Spec |
|---|---|
| Gesture | Long-press (0.25 s) then drag, **or** an immediate drag if the chart is not inside a horizontally scrolling container |
| Crosshair | 1pt vertical rule in `viz.crosshair` (`text.secondary`), **snapped to the nearest sample**, never free-floating. The reader aims at a time, not at a line. |
| Sample markers | Every Series shows an 8pt dot (r 4) with a 2pt `surface.raised` ring at the crosshair |
| Readout | Appears in the **chart header**, replacing the "now" value — not as a floating bubble that occludes the plot under the finger. Shows the timestamp (`type.metric.s`) and **every Series at that x**, values leading in `text.primary`, Series names following in `text.secondary`, each keyed by a **6×2pt line stroke** in the Series colour (a line-key, not a filled box). |
| Off-plot drag | Clamps to the domain edges |
| Release | Crosshair fades over `motion.fast`; readout returns to "now" |
| Haptic | `.selection` on each snap to a new sample, rate-limited to 20 Hz |
| Keyboard / Full Keyboard Access | Focus the chart, then ← / → move the crosshair one sample, ⇧← / ⇧→ move ten. Identical readout to touch. |
| **Never gates a value** | Everything the readout shows is also reachable via the direct endpoint label and the **table view** (§8.10) |
| Labels are untrusted | Series names originate from the Agent; they are rendered as text, never interpolated into markup |

### 8.6 Null and gap handling — the critical rule

> **A gap is never interpolated. Not in a chart, not in a Sparkline, not in a widget.**

Per README principle P5 and [06-DATA-MODEL](06-DATA-MODEL.md), the Agent keeps recording while the Tunnel is down and backfills on reconnect — so most gaps in Client-side data are *transport* gaps that later fill in, and a small number are *genuine* Agent-side gaps (the Agent was down). Rendering these identically would be a lie. Three distinct renderings:

| Gap kind | Definition | Rendering |
|---|---|---|
| **Transport gap (pending backfill)** | The Client is missing samples the Agent is known to hold | Stroke and fill stop at the last sample and resume at the first sample after the gap. The gap region carries a **45° hatch** in `viz.gap` (`#39434B` dark / `#C6CFD4` light), 1pt lines at 4pt pitch. A `type.micro` `PENDING` label sits centred in the gap if it is ≥ 40pt wide. |
| **Agent gap (no data recorded)** | The Agent was not running or not sampling | Same stop/resume, but the hatch is at **135°** (the mirror angle) and the label reads `NO DATA`. The two angles are the texture channel doing exactly the job §2.11 rule 1 demands: the distinction survives greyscale and CVD. |
| **Single missing sample** | One interval absent | The line breaks — a 1-sample discontinuity, no hatch (too small to hatch). The gap is still not bridged. |

Additional rules:

- The hatch region's edges are **hard**, not feathered. A soft edge implies uncertainty about *when* the gap started; the Client knows exactly.
- A gap adjacent to "now" (the current disconnection) extends to the right edge of the plot and the endpoint dot is **not** drawn — there is no current value.
- Aggregations across a range containing a gap are labelled: `avg 42.1 % (excludes 14 min)`. Never silently averaged over the present samples as if the window were complete.
- Backfill arriving replaces the hatch with real marks over `motion.base`, and posts a VoiceOver announcement: `Backfilled 14 minutes of data`.
- **The gap legend** (`minus.diamond` glyph + hatch swatch + label) appears in any chart footer where at least one gap is rendered. It never appears otherwise.

### 8.7 Threshold and annotation rendering

Alert Rules ([02-SRS](02-SRS.md), [06-DATA-MODEL](06-DATA-MODEL.md)) are drawn onto the charts they govern.

| Element | Spec |
|---|---|
| Threshold rule | Horizontal, **2pt dashed 4-on-3-off**, in `status.warning` or `status.critical` per the rule's severity. Dashing is reserved for exactly this and the `unknown` pill rim, so a dashed horizontal in a chart unambiguously means "an Alert Rule lives here". |
| Threshold label | Right-aligned at the plot's trailing edge, `type.micro`, in the threshold's status token, on a 2pt-padded `surface.raised` chip so it stays legible where it crosses the data |
| Fixed system thresholds | Temperature charts always draw 80 °C and 85 °C in `status.warning` / `status.critical` with the labels `soft throttle` / `hard throttle`, whether or not the user has an Alert Rule there. These are properties of the hardware, not of the user's configuration. |
| Dwell shading | While a rule's predicate holds but the dwell time has not elapsed, the region between the threshold and the data is filled with the status token at **8%**. Once the Alert fires the fill goes to **16%** and a 3pt marker appears on the x-axis at the fire time. |
| Fired-Alert marker | A 3pt-wide full-height rule at the fire timestamp in the severity token at 40%, plus a 10pt severity glyph on the x-axis band. Tapping it opens the Alert detail. |
| Resolution marker | Same geometry, `status.ok`, hollow glyph |
| Annotation density | If more than 6 markers fall inside the visible range, they collapse into a single count chip on the axis band (`6 alerts`) that expands the table view (§8.10) on tap |
| Never | A threshold is never drawn as a filled band across the whole plot — it would compete with the data for the reader's attention |

### 8.8 Live-tail behaviour

| Rule | Spec |
|---|---|
| Default | The Dashboard and any chart whose range is `15m` or `1h` is **live-tailing**: new samples arrive over the `telemetry` Channel and extend the plot. |
| Window motion | On each sample the x-window advances by exactly one sample interval over `motion.data` (180 ms linear). It does not scroll continuously between samples — that would imply time is being sampled continuously (P-D2). |
| Pause | Any scrub, pan or pinch **pauses live tail**. A `PAUSED · resume ›` chip appears in the chart header in `status.info`. New samples accumulate off-screen. |
| Resume | Tapping the chip, or scrolling back to the trailing edge, resumes and animates the accumulated samples in over a single `motion.base`. |
| Auto-resume | After 30 s of no interaction while paused, live tail resumes automatically, announced with a `.selection` haptic. Ranges ≥ `6h` never auto-resume. |
| Long ranges | `6h` and longer do **not** live-tail; they refresh on an explicit pull-to-refresh or on a range re-selection, because a 1-pixel change per minute is not worth the wake. |
| Backgrounding | Live tail stops when the app leaves the foreground. On return, the chart shows the gap (§8.6) until the backfill lands. |

### 8.9 Sparkline rules in tiles and widgets

| Context | Points | Height | Fill | Endpoint | Threshold | Gaps |
|---|---|---|---|---|---|---|
| StatTile | 60 | 32pt | 10% | yes, 8pt + ring | 1pt @ 50% if in domain | hatched |
| List row inline | 24 | 20pt | 10% | yes, 6pt + ring | no | hatched |
| `accessoryRectangular` widget | 24 | 16pt | none (fill is invisible at accessory tint) | yes, 5pt | no | **hatched — mandatory** |
| `systemSmall` widget | 32 | 24pt | 10% | yes, 6pt | 1pt @ 50% | hatched |
| `systemMedium` widget | 48 | 28pt | 10% | yes, 6pt | 1pt @ 50% | hatched |

Sparklines carry **no legend, no axis, no label, no tooltip**. If the reader needs any of those, the component should be a MetricChart. In a widget a Sparkline is always accompanied by its numeric value and its age stamp ([08-WIDGETS](08-WIDGETS.md) staleness contract).

### 8.10 Legends, direct labels, and the table view

| Rule | Spec |
|---|---|
| **1 Series** | **No legend box.** The chart title names the Series. A one-swatch legend restates the title and costs 20pt. |
| **≥ 2 Series** | **A legend is always present.** It is the dependable identity channel; the reader must never have to colour-match against memory. |
| Legend placement | Directly beneath the chart title, above the plot, wrapping horizontally; becomes a vertical list at Dynamic Type ≥ `AX2` |
| Legend mark | **Mirrors the chart's mark**: a 12×2pt line stroke for line charts, a 10×10pt `radius.xs` rect for areas and bars |
| Legend text | `type.caption` in `text.secondary` — **never in the Series colour** |
| Direct labels | The **endpoint** of each Series is labelled when ≤ 4 Series are shown: value in `type.metric.s` `text.primary` with the Series' line-key immediately before it. Never a number on every point. |
| Converging endpoints | When end-labels would overlap, use **leader lines** (1pt, `viz.axis`, from label to line end). Past 4 converging Series, switch to small multiples. |
| In-mark labels | Only when the rendered text fits with ≥ 4pt padding on both sides. Otherwise the label moves outside the mark end, or drops to the readout. **Never clipped, never `overflow: hidden`.** |
| **Table view** | **Every MetricChart has a table twin.** The chart header's `⋯` menu carries `Show as table`. The table lists timestamp + one column per Series, `type.metric.s` tabular, right-aligned, with gap rows rendered as `—` and a trailing `no data` / `pending` column. This is the WCAG-clean equivalent and the reason no value in this system is gated behind a gesture. |
| Texture channel | Settings → Accessibility → `Use patterns in charts` (also forced on under `forced-colors`-equivalent and in printed/exported PDFs) applies the 45°/135° hand-drawn line fill to area and bar marks, tone-on-tone, ordered on value scales. Off by default — it is an accessibility channel, never decoration. |

### 8.11 Anti-pattern checklist (run before shipping any chart)

- [ ] No dual axis anywhere.
- [ ] Colour follows the Series entity, not its rank; filtering does not repaint survivors.
- [ ] No generated 9th hue; tails fold to "Other" in `viz.deemphasis`.
- [ ] No value-ramp on nominal categories (mounts, interfaces, processes).
- [ ] Sequential ramps are one hue; the only multi-hue sequential is the thermal ramp, and it ships a scale legend.
- [ ] No hue at a diverging midpoint.
- [ ] Status colours only where the Series means good/bad.
- [ ] Marks are thin; gridlines are recessive solid hairlines.
- [ ] 2px surface gap between touching marks; 2px surface ring on overlapping dots. No borders drawn around marks.
- [ ] No number on every point; endpoints and extremes only.
- [ ] No label clipped by its own mark.
- [ ] Card height includes the axis band — no nested scroll.
- [ ] Hero figure is SF Mono, not a display face.
- [ ] Scrub readout never gates a value; the table view exists.
- [ ] Hit targets ≥ 44pt.
- [ ] One filter row above everything it scopes.
- [ ] Refetch holds the previous render at 60%; no skeleton flash.
- [ ] **Gaps are hatched, never interpolated.**
- [ ] Dark-mode steps were selected and validated against `#141A1F`, not flipped from light.

---

## 9. Accessibility

Target: **WCAG 2.2 AA** for contrast and target size, plus Apple's platform expectations. [09-TEST-PLAN](09-TEST-PLAN.md) owns the verification cases; this section owns the specification.

### 9.1 Contrast verification method

1. Every foreground/background pair in §2 carries a measured ratio computed with the WCAG 2.x relative-luminance formula (the `contrast()` export of `scripts/validate_palette.js`), against the **actual** surface the token renders on — not against a nominal white or black.
2. Text pairs must be **≥ 4.5:1**; all listed text tokens pass. `text.disabled` is exempt under WCAG 1.4.3's inactive-control exception and is the only exemption claimed in this system.
3. UI components and graphical objects must be **≥ 3:1**: `border.strong`, `border.focus`, every status token, every categorical slot, every thermal step, the GaugeRing fill, and every chart mark. All pass.
4. Decorative hairlines (`border.hairline`, `border.subtle`, `viz.grid`, `viz.axis`, gap hatch) carry **no** minimum because they encode nothing that is not also encoded by position or by an adjacent labelled element.
5. A CI check re-runs the validator plus a contrast table over the Asset Catalog on every change to a Color Set and fails the build on a regression. The check must run against **both** appearances and both the standard and High Contrast variants.

### 9.2 VoiceOver — per component

Format below: **label** · *traits* · `value` · hint. Every component announces state in **words**, never by colour, and never by tone.

| Component | VoiceOver contract |
|---|---|
| **StatusPill** | Label: `"Status: online"` / `"Status: offline"` / `"Status: unknown"`. Value: the trailing detail (`"34 milliseconds"`). Traits: `.isButton` only when tappable. Hint (tappable only): `"Opens connection diagnostics."` |
| **AgentCard** | Combined into **one** element. Label: `"pi5-livingroom, online, direct connection"`. Value: `"CPU 12 percent, temperature 54 degrees Celsius, memory 38 percent, up 14 days"`. Traits: `.isButton`. Hint: `"Opens this Pi's dashboard."` Offline variant appends `"Last updated 6 minutes ago."` |
| **StatTile** | Label: the eyebrow in sentence case, `"CPU"`. Value: `"12.4 percent, trending up, 1 hour range"` — the trend word is derived from the Sparkline's first-to-last delta so the sparkline's information is not lost. Traits: `.isButton`, plus `.updatesFrequently` **only while live-tailing**. Hint: `"Opens CPU history."` Stale variant: `"12.4 percent, last updated 4 minutes ago"`. Empty: `"CPU, no data"`. |
| **Sparkline** | `.accessibilityHidden(true)`. Its information lives in the parent's value. |
| **GaugeRing** | Label: the caption, `"Disk used"`. Value: `"38 percent of 64 gigabytes"`. Traits: `.isImage` (or `.isButton` when tappable). Adjustable when it is a control (bitrate budget): `.isAdjustable` with increment/decrement. |
| **MetricChart** | Label: the chart title. Value: a spoken summary — `"SoC temperature, last 6 hours, 96 samples, minimum 41.2, maximum 83.4, current 54.2 degrees Celsius. 2 gaps totalling 14 minutes. Warning threshold at 80."` Traits: `.allowsDirectInteraction` is **not** used. Instead the chart exposes an **Audio Graph** (`AXChart` / `accessibilityChartDescriptor`) so VoiceOver users get sonification and per-point navigation, and the rotor offers `Show as table`. Every gap is announced as `"gap, 6 minutes, pending backfill"` in sequence. |
| **Scrub crosshair** | Not directly exposed; the Audio Graph replaces it. When Full Keyboard Access is on, ← / → move the crosshair and each move announces `"14:32, 54.2 degrees"`. |
| **LogRow** | Label: `"Warning"` (the level, spoken first — severity leads). Value: `"14:32:07, agent telemetry, sample interval overrun 5.4 seconds"`. Traits: `.isButton` when expandable. Custom action: `"Copy line"`. |
| **TerminalSurface** | Exposed as a **text element with `.updatesFrequently`**, whose value is the visible buffer with trailing whitespace collapsed. New output is announced via `.announcement` **only when the app is foreground and the user has not scrolled back**, throttled to one announcement per 2 s, and truncated to the last 200 characters. A rotor item `"Terminal output"` navigates line by line. The accessory bar's keys each carry a spoken name (`"Control key, toggle"`) with `.isToggle` traits for latching modifiers. |
| **DesktopViewport** | See §9.6 — this needs its own strategy. |
| **ConnectionBanner** | One element. Label: `"Connection"`. Value: `"Direct, 34 milliseconds, verified and encrypted"` / `"Relayed through server, 128 milliseconds, verified and encrypted"` / `"Offline, last seen 14:22"`. Traits: `.isButton`, `.isHeader` (it is the first element after the nav bar and should be reachable by heading navigation). The **key-mismatch** state additionally posts a `.screenChanged` announcement and takes focus: `"Warning. This Pi's identity key has changed. Do not enter passwords. Double tap to review."` |
| **AlertRow** | Label: `"Critical"` (severity first). Value: `"SoC temp above 80 degrees, pi5-livingroom, firing for 2 minutes, currently 83.4 degrees"`. Traits: `.isButton`. Custom actions mirror the swipe actions: `"Acknowledge"`, `"Snooze one hour"`, `"Mute rule"`. |
| **ActionButton** | Label: the button text. Traits: `.isButton`; destructive variants add `.isDestructive` (`accessibilityRespondsToUserInteraction` + `UIAccessibilityTraitDestructive` semantics via `accessibilityCustomActions` where applicable). Loading: value `"In progress"` and `.isNotEnabled`. Disabled: `.isNotEnabled` plus the reason string appended to the value. |
| **Destructive confirm slider** | Traits: `.isAdjustable`. Label: `"Slide to reboot pi5-livingroom"`. Increment/decrement move it in 25% steps; reaching 100% commits. VoiceOver users are **not** required to perform a drag. |
| **FingerprintVerificationView** | The hex block is one element whose label is `"Fingerprint"` and whose value is the hex **spoken in groups of four with pauses**: `"9 F 2 C, 4 A 8 1, …"` — each character spelled individually (`accessibilitySpeechSpellsOutCharacters`), never read as a word. The word sequence is a separate element read normally. A custom rotor action `"Repeat fingerprint slowly"` re-reads at reduced rate. The two buttons are plainly labelled `"They match"` and `"They do not match"`; the latter carries `.isDestructive`. |
| **EmptyState / ErrorState** | Container is one element: title + body + code, in that order. The retry button is separate. The error code is spelled character by character. |
| **SkeletonLoader** | Container label `"Loading"`, `.updatesFrequently` **not** set (nothing to update). Bars hidden. |

### 9.3 Dynamic Type

Full support `xSmall` → `AX5`, with the per-role caps in §3.4. Verification requirements:

- Every screen must be walked at `xSmall`, `Large`, `xxxLarge`, `AX1`, `AX3` and `AX5`. No clipping, no overlap, no unreachable control at any size.
- The 2-column tile grid collapses to 1 column at `AX1`.
- Legends become vertical lists at `AX2`.
- `type.micro` eyebrows move above their values at `AX3`.
- Tab bar labels are allowed to truncate (iOS behaviour) but the tab bar switches to the system's large-content viewer on long-press at `AX1`+.
- Nothing on the must-never-truncate list (§3.4) truncates at any size, including `AX5`.

### 9.4 Hit targets

| Rule | Value |
|---|---|
| Minimum interactive target | **44 × 44pt**, always, including targets whose visual is smaller (StatusPill at 22pt tall carries a 44pt hit area) |
| Chart scrub target | The full plot rect, 176pt tall minimum |
| Chart mark hit target (bars, event-strip segments) | Includes the 2pt surface gap plus enough padding to reach 44pt; for dense marks a nearest-point layer is used so the finger only has to be *closest* |
| Spacing between adjacent targets | ≥ 8pt of non-interactive space, or targets are merged |
| Keyboard accessory keys | 44 × 36pt visual, 44 × 44pt target |
| DesktopViewport overlay keys | 36 × 36pt visual, 44 × 44pt target |

### 9.5 Haptics vocabulary

Haptics are a semantic channel, not garnish. **Ten patterns, fixed meanings.** Nothing else in the app may vibrate.

| Event | Pattern |
|---|---|
| Tunnel established | `.notification(.success)` |
| Tunnel lost | `.notification(.warning)` |
| Handshake failed / fingerprint mismatch | `.notification(.error)` |
| Alert arrives (critical) while foreground | `.notification(.error)` |
| Alert arrives (warning) while foreground | `.notification(.warning)` |
| Any button press | `.impact(.light)` |
| Destructive slider engaged | `.impact(.rigid)` |
| Destructive Action committed | `.notification(.warning)` |
| Chart scrub snaps to a new sample | `.selection`, rate-limited to 20 Hz |
| Segmented control / chip / toggle change | `.selection` |

Suppressed entirely when the system's haptics are off, and reduced to *success/warning/error only* when the app is in the background delivering a Live Activity update ([08-WIDGETS](08-WIDGETS.md)).

### 9.6 Remote Desktop — the special accessibility strategy

A live remote framebuffer is **opaque to assistive technology**: VoiceOver cannot read pixels, the elements have no accessibility tree, and the Client has no semantic model of what the Pi is displaying. Pretending otherwise — labelling the viewport `"Remote screen"` and leaving it at that — makes the feature unusable rather than merely limited. The strategy has five parts.

**1. The viewport is never the only path to a capability.** Every operation the product *promises* is reachable without pixels: Actions cover reboot/service control; Remote Shell covers arbitrary commands with full VoiceOver text access; Alerts and the Dashboard cover observation. Remote Desktop is explicitly positioned as a convenience layer over capabilities that exist elsewhere. This is the primary mitigation and it constrains the requirements: **no capability may be exposed *only* through Remote Desktop.** [02-SRS](02-SRS.md) should carry this as a requirement.

**2. The viewport is a direct-interaction surface with an explicit toggle.** The framebuffer view sets `.accessibilityElement(children: .ignore)` with the `.allowsDirectInteraction` trait, so a VoiceOver user's gestures pass through to pointer/touch injection instead of being consumed by VoiceOver. Because this trait silently disables VoiceOver navigation inside the region, it is **announced on entry** — `"Remote screen. Direct interaction on. Gestures control the Pi. Two-finger scrub to exit."` — and a persistent, always-VoiceOver-visible `Direct interaction` toggle sits in the overlay so it can be turned off to navigate away.

**3. Structured accessibility from the Agent, when available.** Where the Pi's session exposes AT-SPI (the Linux accessibility bus), the Agent MAY forward a **flattened accessibility tree** over the `control` Channel — role, name, value, bounds — and the Client renders it as a **real, navigable accessibility layer over the viewport**: each remote element becomes an accessibility element at its mapped rect, with its role translated to the nearest iOS trait, and activating it injects a click at that rect's centre. This is the difference between "a picture of a screen" and "a remote UI". It is optional, capability-negotiated, and degrades to part 4. [03-ARCHITECTURE](03-ARCHITECTURE.md) and [05-PROTOCOL](05-PROTOCOL.md) must carry the capability flag and the message shape; [10-ROADMAP](10-ROADMAP.md) should schedule it as a distinct phase.

**4. A described-state fallback.** When no accessibility tree is available, the viewport's accessibility value is a **machine-derived state summary the Client can honestly produce**: `"Remote screen, 1920 by 1080, 12 frames per second, relayed. Focused window title: Terminal — pi@pi5. Last input: click at 42 percent across, 61 percent down."` The window title comes from the compositor over the `control` Channel, not from image analysis; the Client never guesses at content it cannot know. If even the title is unavailable, the value says so: `"Window title unavailable."`

**5. Pointer position is always speakable.** In `direct` and `pen` pointer modes the current pointer coordinate is exposed as a live region announcing on a 400 ms throttle as a **percentage of the viewport** (`"48 percent across, 22 percent down"`), because absolute pixel coordinates are meaningless without seeing the screen. In `trackpad` mode, movement is announced only on request via a rotor action `"Where is the pointer?"`.

**Additional viewport accessibility rules:** Reduce Motion does not stop video (the video *is* the content), but it suppresses the auto-hide animation of the overlay and disables pinch-zoom inertia. VoiceOver users get a rotor with `Modifier keys`, `Pointer mode`, `Quality`, `Where is the pointer?`, `Disconnect`. Switch Control users get a scanning-friendly overlay: every overlay control is a discrete, ordered element, and the viewport itself is excluded from the scan group unless direct interaction is toggled off.

---

## 10. Localization and RTL

Languages at v1: **English (en)** and **Arabic (ar)**.

### 10.1 Mirroring

The layout mirrors under RTL (`layoutDirection == .rightToLeft`). Leading/trailing semantics are used everywhere; `left`/`right` never appear in layout code or in this document's component specs.

| Mirrors | Does **not** mirror | Why |
|---|---|---|
| Navigation (back chevron, push direction) | **Chart time axis** — time always flows left → right | Time direction is a data convention, not a reading convention. Mirroring it would invert every trend the user has learned. Axis *labels* localise; axis *direction* does not. |
| List rows, disclosure chevrons, swipe action sides | **Sparklines** | Same reason; a sparkline is a time axis. |
| StatTile internals (eyebrow, value, unit order) | **TerminalSurface** | A PTY is a fixed LTR cell grid. Escape sequences, box-drawing, and column alignment all assume LTR. The surface renders LTR inside an otherwise mirrored screen, with its own scroll direction. |
| AlertRow severity stripe (moves to the leading edge) | **DesktopViewport** | The remote framebuffer is a picture of another machine. Mirroring it would mirror the Pi's own UI. |
| Tab bar order | **Fingerprint hex blocks** | Hex fingerprints are compared character by character against a screen that renders them LTR; mirroring would guarantee comparison errors. Rendered LTR with an explicit `⁦…⁩` isolate. |
| ConnectionBanner segment order | **IP addresses, MAC addresses, paths, hostnames, log lines, error codes** | All bidi-isolated and rendered LTR. |
| Sheets, menus, alerts | **GaugeRing sweep direction** | The ring reads as a filling quantity, not as text; keeping it consistent avoids "is 38% filled or 62% empty?" |
| Progress rails, sliders | | |

Every LTR-locked element is wrapped in Unicode **first-strong isolates** (`FSI`/`PDI`) so it composes correctly inside a mirrored paragraph without leaking direction.

### 10.2 Numerals

| Rule | Spec |
|---|---|
| Metric values, chart ticks, fingerprints, error codes, ports, byte counts | **Western Arabic (ASCII) digits always**, in both locales. Rationale: these are technical quantities compared against terminal output, `htop`, and the Pi's own display, all of which emit ASCII digits. Rendering `٥٤.٢` beside a terminal showing `54.2` invites transcription errors. |
| Prose numbers, dates, relative times ("2 minutes ago") | Locale numerals via `NumberFormatter` / `RelativeDateTimeFormatter` — Eastern Arabic-Indic digits in `ar` |
| Decimal and grouping separators | Locale-correct in prose; **`.` decimal and `,` grouping (or thin space) forced** in metric readouts, matching the digit rule above |
| Units | Localised names but **never localised symbols**: `°C`, `%`, `MB/s`, `ms` stay as-is |
| Escape hatch | Settings → Appearance → `Use Arabic-Indic digits for metrics` (default **off**), for users who prefer consistency with the rest of their system |

### 10.3 Type and fallback for Arabic

| Rule | Spec |
|---|---|
| Face | **SF Arabic** (Text below 20pt, Display at and above), the system's own Arabic companion to SF Pro — metrics-compatible, so the type scale in §3.2 holds unchanged |
| Line height | +2pt on every role below 20pt, to accommodate Arabic ascenders/descenders without clipping |
| Tracking | **0 for all Arabic text.** Negative tracking breaks Arabic joining; the `type.micro` +0.6pt tracking is also dropped. |
| Uppercase | **Not applicable.** Arabic has no case. `type.micro` eyebrows render in SF Arabic at 11pt Semibold with no transform; the visual distinction is carried by weight and `text.tertiary` colour alone. |
| Monospace | **SF Mono has no Arabic coverage.** Any mixed string in a mono role falls back to SF Arabic for the Arabic runs and keeps SF Mono for digits and Latin. Because §10.2 forces ASCII digits in metric readouts, the numeric column alignment that §3.3 protects is preserved regardless. |
| Terminal | Always SF Mono, always LTR (§10.1). Arabic output from the Pi renders with the system fallback inside the cell grid; the Client makes no attempt to reshape it. |
| Truncation | Arabic strings are ~20–30% longer than English on average; every label in the app is laid out to accommodate **+35%** without truncating. Verified by a pseudo-localisation pass in [09-TEST-PLAN](09-TEST-PLAN.md). |

---

## 11. Token naming convention

```
<group>.<role>[.<variant>][.<state>]
```

- `group` — one of `surface`, `border`, `text`, `accent`, `status`, `thermal`, `viz`, `terminal`, `space`, `radius`, `type`, `motion`, `elev`.
- `role` — the semantic slot inside the group (`canvas`, `primary`, `warning`, `series.3`).
- `variant` — an optional qualifier (`high`, `muted`, `wash`, `strong`).
- `state` — an optional interaction state (`pressed`, `focus`, `disabled`).

**Rules**

1. Names describe **purpose**, never appearance. `status.critical`, never `red`. `accent.base`, never `cyan500`.
2. Lower camel inside a segment (`viz.deemphasis`, `type.metric.xl`), dots between segments.
3. The **same name resolves in both appearances**. There is no `…Dark` suffix anywhere; the Asset Catalog holds both values.
4. Numeric scale steps are three-digit (`viz.sequential.400`) so steps can be inserted without renaming.
5. A component never defines a private colour. If a component needs a value that does not exist, a token is added here first.
6. Deprecated tokens keep their name and gain a `@deprecated` note for one release; they are never silently repointed.

---

## 12. Machine-readable token table

Transcribe directly into `Colors.xcassets` (colour tokens) and a constants file (dimension/motion tokens). **Light = "Any Appearance"; Dark = "Dark Appearance".** All colours are sRGB hex.

### 12.1 Colour tokens

| Token | Light | Dark | Usage |
|---|---|---|---|
| `surface.canvas` | `#EEF1F3` | `#0B0F12` | Screen and scroll background |
| `surface.raised` | `#FFFFFF` | `#141A1F` | Cards, tiles, list rows |
| `surface.raised2` | `#F7F9FA` | `#1C242B` | Nested surfaces, sheets, accessory bar |
| `surface.sunken` | `#E2E7EA` | `#06090B` | Terminal ground, chart well, fingerprint block |
| `surface.overlay` | `#FFFFFF` | `#1F2831` | Menus, popovers, tooltips, toasts |
| `surface.scrim` | `#0D1418` @ 40% | `#000000` @ 62% | Behind sheets and dialogs |
| `surface.letterbox` | `#000000` | `#000000` | DesktopViewport letterbox only |
| `border.hairline` | `#DCE3E7` | `#232C34` | Dividers inside a card |
| `border.subtle` | `#D3DBE0` | `#2A343C` | Card / tile / plot outline |
| `border.strong` | `#78848B` | `#5A6873` | Meaning-bearing borders (≥3:1) |
| `border.focus` | `#026E77` | `#2FBCCF` | Keyboard focus ring, 2pt |
| `border.destructive` | `#C22118` | `#F2564F` | Destructive control outline |
| `text.primary` | `#0D1418` | `#EEF3F5` | Primary text |
| `text.secondary` | `#4A5860` | `#A7B4BC` | Secondary text, stale values |
| `text.tertiary` | `#5E6C74` | `#85929A` | Eyebrows, captions, axis labels |
| `text.disabled` | `#9AA6AD` | `#4E5A62` | Disabled controls only (contrast-exempt) |
| `text.onAccent` | `#FFFFFF` | `#04191C` | Text on `accent.base` fill |
| `text.onCritical` | `#FFFFFF` | `#140605` | Text on `status.critical` fill |
| `accent.base` | `#026E77` | `#2FBCCF` | Tint, links, primary fill, selection |
| `accent.high` | `#0A8B96` | `#5AD0E0` | Highlighted state, chart endpoint (mark only in light) |
| `accent.pressed` | `#015159` | `#1E93A3` | Pressed fill/ink |
| `accent.muted` | `#B7E4EA` | `#0E6874` | Large fills, selected-row background |
| `accent.wash` | `accent.base` @ 10% | `accent.base` @ 12% | Selection wash, sparkline area fill |
| `status.ok` | `#0F7A3D` | `#2FB463` | Reachable, no Alert firing |
| `status.info` | `#1160C4` | `#4E9BEC` | Relayed path, backfilling, rekey scheduled |
| `status.warning` | `#8A6100` | `#E0A61C` | Warning-severity Alert, stale Snapshot |
| `status.critical` | `#C22118` | `#F2564F` | Critical Alert, handshake failure, key mismatch |
| `status.serious` | `#B0521A` | `#EE7B2E` | Optional tier between warning and critical |
| `status.offline` | `#5B6970` | `#7A8A94` | Known-unreachable Agent |
| `status.unknown` | `#6E665C` | `#9A938A` | Never contacted / cache expired (always dashed rim) |
| `thermal.1` | `#B58C00` | `#E6B731` | 50–60 °C |
| `thermal.2` | `#AF6F00` | `#E89400` | 60–67 °C |
| `thermal.3` | `#AA4D00` | `#E76E08` | 67–74 °C |
| `thermal.4` | `#A22400` | `#DB4822` | 74–80 °C |
| `thermal.5` | `#8C0010` | `#C9222B` | ≥ 80 °C (throttling) |
| `viz.series.1` | `#00999F` | `#10A6AD` | Categorical slot 1 (cyan) |
| `viz.series.2` | `#B65E07` | `#D67523` | Slot 2 (orange) |
| `viz.series.3` | `#7838F8` | `#8B78DE` | Slot 3 (violet) |
| `viz.series.4` | `#08833C` | `#2E9E52` | Slot 4 (green) |
| `viz.series.5` | `#C60F91` | `#CF60A4` | Slot 5 (magenta) |
| `viz.series.6` | `#8B7404` | `#AB9017` | Slot 6 (yellow) |
| `viz.series.7` | `#0D6BCC` | `#4687D8` | Slot 7 (blue) |
| `viz.series.8` | `#C70A18` | `#D7564D` | Slot 8 (red) |
| `viz.sequential.100` | `#B7E4EA` | `#B7E4EA` | Sequential ramp step (mode-invariant hexes; the *anchor* flips) |
| `viz.sequential.200` | `#8FD3DD` | `#8FD3DD` | |
| `viz.sequential.300` | `#63C0CD` | `#63C0CD` | Light-mode ordinal floor |
| `viz.sequential.400` | `#2FA9BA` | `#2FA9BA` | |
| `viz.sequential.500` | `#0B8B9B` | `#0B8B9B` | Default meter fill |
| `viz.sequential.600` | `#046F7C` | `#046F7C` | |
| `viz.sequential.700` | `#01545E` | `#01545E` | Dark-mode ordinal floor |
| `viz.diverging.neg3` | `#01545E` | `#B7E4EA` | Strongly below baseline |
| `viz.diverging.neg2` | `#0B8B9B` | `#63C0CD` | |
| `viz.diverging.neg1` | `#63C0CD` | `#12909F` | |
| `viz.diverging.zero` | `#D5DBDF` | `#3A444C` | Neutral midpoint — **never a hue** |
| `viz.diverging.pos1` | `#E9A868` | `#B0651F` | |
| `viz.diverging.pos2` | `#B96E14` | `#E08A46` | |
| `viz.diverging.pos3` | `#7A4405` | `#F5BE72` | Strongly above baseline |
| `viz.grid` | `#E7ECEF` | `#1E262D` | Gridlines, solid 1pt |
| `viz.axis` | `#CBD4D9` | `#2E3941` | Baseline and axis rule |
| `viz.tickLabel` | `#5E6C74` | `#85929A` | Axis tick text (= `text.tertiary`) |
| `viz.deemphasis` | `#78848B` | `#5A6873` | "Other", context lines, emphasis-form background series |
| `viz.gap` | `#C6CFD4` | `#39434B` | Gap hatch ink (45° pending / 135° no-data) |
| `viz.crosshair` | `#4A5860` | `#A7B4BC` | Scrub crosshair (= `text.secondary`) |
| `terminal.bg` | `#F7F9FA` | `#06090B` | Terminal ground (dark used in both by default) |
| `terminal.fg` | `#1B2429` | `#C7D1D7` | Default foreground |
| `terminal.cursor` | `#026E77` | `#2FBCCF` | Cursor |
| `terminal.selection` | `accent.base` @ 24% | `accent.base` @ 24% | Selection |
| `terminal.ansi.0` … `terminal.ansi.15` | see §2.9 | see §2.9 | ANSI 16-colour map |

### 12.2 Dimension tokens

| Token | Value | | Token | Value |
|---|---|---|---|---|
| `space.0` | 0 | | `radius.none` | 0 |
| `space.1` | 2pt | | `radius.xs` | 4pt |
| `space.2` | 4pt | | `radius.s` | 8pt |
| `space.3` | 8pt | | `radius.m` | 10pt |
| `space.4` | 12pt | | `radius.l` | 12pt |
| `space.5` | 16pt | | `radius.xl` | 16pt |
| `space.6` | 20pt | | `radius.pill` | height / 2 |
| `space.7` | 24pt | | `border.width.hairline` | 1 / displayScale |
| `space.8` | 32pt | | `border.width.regular` | 1pt |
| `space.9` | 40pt | | `border.width.emphasis` | 2pt |
| `space.10` | 56pt | | `target.min` | 44pt |

### 12.3 Motion tokens

| Token | Duration | Curve |
|---|---|---|
| `motion.instant` | 80 ms | easeOut |
| `motion.fast` | 140 ms | cubic(0.2, 0, 0, 1) |
| `motion.base` | 220 ms | cubic(0.4, 0, 0.2, 1) |
| `motion.slow` | 320 ms | cubic(0.4, 0, 0.2, 1) |
| `motion.deliberate` | 480 ms | cubic(0.4, 0, 0.2, 1) |
| `motion.data` | 180 ms | linear |
| `motion.pulse` | 1200 ms | easeInOut, one cycle per event |
| `motion.spring.ui` | response 0.32 | damping 0.86 |
| `motion.spring.snap` | response 0.22 | damping 1.0 |

### 12.4 Elevation tokens

| Token | Light | Dark |
|---|---|---|
| `elev.0` | none | none |
| `elev.1` | y 2 · blur 8 · `#0D1418` @ 8% | y 2 · blur 8 · `#000000` @ 40% + 1px `border.subtle` rim |
| `elev.2` | y 8 · blur 24 · `#0D1418` @ 12% | y 8 · blur 24 · `#000000` @ 52% + 1px `border.subtle` rim |

---

## 13. Open questions for the requirements author

Recorded here so [02-SRS](02-SRS.md) and [12-RISK-REGISTER](12-RISK-REGISTER.md) can pick them up:

1. **No capability may exist only inside Remote Desktop** (§9.6 part 1). This needs to be a numbered non-functional requirement, because it constrains feature design permanently.
2. **AT-SPI accessibility-tree forwarding** (§9.6 part 3) needs a capability flag in [05-PROTOCOL](05-PROTOCOL.md) and a phase in [10-ROADMAP](10-ROADMAP.md).
3. **The Client must be able to distinguish a transport gap from an Agent gap** (§8.6). That requires the Agent to report its own sampling-coverage intervals, not just samples — a [06-DATA-MODEL](06-DATA-MODEL.md) and [05-PROTOCOL](05-PROTOCOL.md) concern.
4. **Handshake milestone events** must be observable by the Client to drive the four-stage ConnectionBanner rail (§6.2) without a fake timer.
5. **Rollup tier must be reported alongside every Series response** so the chart can state its resolution (§8.4).
6. The **`serious` severity tier** is specified but optional; [02-SRS](02-SRS.md) should decide whether Alert Rules have three or four severities.
