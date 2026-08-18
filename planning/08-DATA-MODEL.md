# 08 — Data Model

Agent-side time-series storage + retention + downsampling, and the client cache.
The full metric catalogue lives in the client today at
`client/src/sim/metrics.ts` and in [`../docs/06-DATA-MODEL.md`](../docs/06-DATA-MODEL.md);
this is the implementation-facing summary.

---

## 1. Core concepts

| Term | Meaning |
|---|---|
| **Series** | A named metric stream, e.g. `cpu.temp_c`. Stable key. |
| **Sample** | `{ t: epoch_ms, v: number }`. |
| **Snapshot** | The latest value of every series at one instant, plus `producedAt`, staleness, and coverage. |
| **Rollup** | A downsampled tier (e.g. 1-min, 10-min, 1-hour averages) for older/wider ranges. |
| **Coverage interval** | `{ from, to }` spans where the Agent actually had data — lets the client tell an Agent gap from a transport gap (never interpolate). |

## 2. Series catalogue (keys, unit, cadence, rollup tier)

`T` = transactional/gauge, `L` = rate/derived. Full table in the Agent spec
[§3](05-AGENT.md) and the client's `SERIES` map. Primary set (v1):

`cpu.temp_c`, `cpu.util_pct`, `cpu.core_util_pct[]`, `cpu.freq_mhz`,
`mem.used_pct`, `mem.available_bytes`, `mem.swap_used_bytes`,
`disk.used_pct`, `disk.free_bytes`, `disk.read_bps`, `disk.write_bps`,
`disk.io_util_pct`, `net.rx_bps`, `net.tx_bps`, `net.wifi_rssi_dbm`,
`load.1m/5m/15m`, `psi.cpu/mem/io_some_avg10`, `sys.uptime_s`,
`power.throttled`, `systemd.units_failed`.

Each series declares: `unit`, `kind` (gauge | counter→rate), `cadence_s`,
`cardinality` (1 or N for per-mount/per-iface), and its **rollup tier**.

## 3. Storage design

Two workable options (decide at M-build; SQLite is the pragmatic default):

**Option A — SQLite (recommended default).**
```
series(id INTEGER PK, key TEXT UNIQUE, unit TEXT, kind TEXT)
sample_raw(series_id, t INTEGER, v REAL)          -- recent, full-resolution
sample_rollup(series_id, tier INTEGER, t INTEGER, v_avg REAL, v_min REAL, v_max REAL, n INTEGER)
coverage(series_id, from INTEGER, to INTEGER)
alert(id, rule_id, series_key, severity, fired_at, resolved_at, peak_v, peak_t)
```
- Batch inserts; WAL mode; periodic `PRAGMA optimize`.
- A compaction task rolls raw → tiers and prunes per retention.

**Option B — rollup file store.** Fixed-size ring files per series per tier
(RRD-like). Lower write amplification, less flexible queries. Choose only if SD
endurance measurements demand it.

## 4. Retention & downsampling (defaults)

| Tier | Resolution | Retention |
|---|---|---|
| raw | native cadence (≈10 s) | 90 days |
| 1-min | 1 minute | 90 days |
| 10-min | 10 minutes | 1 year |
| 1-hour | 1 hour | 2 years |

Configurable in `agent.toml`. A query picks the coarsest tier that satisfies the
requested range/resolution and **states which tier it used** so the chart can
declare its resolution.

## 5. Query semantics

- `GET history(key, from, to, res?)` → `{ rollup, samples, coverage }`.
- Stats (min/avg/max/p95) computed over the returned samples **exclude gaps** and
  the response says how much time was excluded — an average that silently ignores
  missing minutes is a lie.
- Backfill: `history` for the exact span the client missed after a drop.

## 6. Client cache

- The client persists recent history + last snapshot per Pi (AsyncStorage today)
  so it can render immediately on open (age-stamped) before the live stream lands.
- Cache is disposable — "clearing it is safe, the real history lives on the Pi"
  (P4). Corruption → offer a one-tap reset.

## 7. Alert data

- Alert history is authoritative on the Pi and **not deletable from the client**.
- An alert row: `{ id, rule_id, series_key, severity, fired_at, resolved_at,
  peak:{v,t}, acknowledged_at, snoozed_until }`.
- Rules: `{ id, series_key, op: above|below, threshold, dwell_s, severity,
  enabled, notify }`.

## 8. Write-endurance notes (SD cards, TC-7)

- Batch writes; keep raw retention modest; compact on a schedule, not per sample.
- Prefer append + periodic rewrite over in-place churn.
- Optionally allow relocating the store to an attached SSD/USB via config.
