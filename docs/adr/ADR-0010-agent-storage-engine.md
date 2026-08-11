# ADR-0010 — On-Pi storage engine: SQLite vs flat WAL files vs an embedded TSDB

## Status

Accepted, 2026-07-24. Binding on [../06-DATA-MODEL.md](../06-DATA-MODEL.md) (schema, retention) and [../11-AGENT-DEPLOYMENT.md](../11-AGENT-DEPLOYMENT.md) (storage location, backup, resource limits).

## Context

Principle P4 says the Pi is the source of truth, and P5 says the Agent keeps recording locally when the tunnel is down and backfills on reconnect. That makes on-Pi persistence a core component, not a cache.

The workload:

| Property | Value |
|---|---|
| Default series count | ~40 (CANON §8) |
| Raw sample interval | 10 s |
| Write rate | ~4 samples/s sustained, arriving in a burst every sampling tick |
| Read patterns | (a) latest Snapshot — 40 point lookups, very frequent; (b) chart range query — one series over a window, with automatic rollup tier selection; (c) backfill — everything since timestamp T across all series; (d) alert-rule evaluation — recent window per rule |
| Other tables | paired clients, alert rules, alert history, action allow-list, audit log, settings — small, transactional, relational |
| Retention ladder | raw 10 s → 48 h; 1-min → 30 d; 5-min → 180 d; 1-h → 2 y |
| Durability requirement | Losing the last few seconds of telemetry on power loss is acceptable. Losing the audit log or the paired-client list is not. |

The distinguishing constraint is the medium. Most Raspberry Pis boot from a microSD card: a consumer-grade flash device with a crude FTL, erase blocks in the 2–4 MiB range, and endurance measured in a few hundred effective program/erase cycles. Storage choice on a Pi is a **write-amplification** decision before it is a query-performance decision.

Note also that the workload is not purely time-series. Alert rules, paired clients, and the audit log are relational, transactional, and safety-relevant. A pure TSDB would leave those homeless.

## Decision

**SQLite via `rusqlite`, in WAL mode, `synchronous=NORMAL`, 4096-byte pages, with all telemetry writes batched into one transaction every 30 s, and an application-level rollup ladder.**

| Setting | Value | Rationale |
|---|---|---|
| Journal mode | WAL | Sequential appends (SD-card friendly), readers never block the writer, crash-safe |
| Synchronous | NORMAL | See the durability discussion below |
| Page size | 4096 | Matches the filesystem block and the typical FTL page; larger pages amplify small writes |
| Write batching | One transaction per 30 s | The single most important wear decision — see arithmetic below |
| Auto-vacuum | Off; periodic incremental vacuum during idle | Full vacuum rewrites the database and is a wear event |
| Checkpointing | Passive, with a WAL size ceiling | Bounds WAL growth without forcing synchronous stalls |
| Sample table key | Append-ordered (series id, timestamp) so inserts land at the end of the B-tree | Avoids scattered page dirtying — the difference between ~3× and ~20× page amplification |
| Location | `/var/lib/pi-monitor/`, relocatable to external storage by configuration | See [../11-AGENT-DEPLOYMENT.md](../11-AGENT-DEPLOYMENT.md) |
| Key material | **Not stored in the database.** Keys live in `/var/lib/pi-monitor/keys/`, mode 0700 | Database loss or corruption never destroys the Agent's identity or the pairing |

### Durability: `synchronous=NORMAL`, stated honestly

In WAL mode with `synchronous=NORMAL`, SQLite does not fsync the WAL on every commit. On a power cut the database **is not corrupted** — WAL mode plus the checkpoint protocol guarantee that — but the **most recent transactions can be lost**. With 30 s batching, the exposure is up to 30 s of telemetry, plus anything committed since the last natural sync.

A Raspberry Pi typically has no UPS and is powered by a wall adapter that a family member will eventually unplug. Power loss is a routine event here, not an exception. We accept losing up to ~30 s of samples in exchange for roughly an order of magnitude less flash wear, because a 30 s gap in a temperature chart is cosmetic.

We do **not** accept that for everything:

| Data | Durability |
|---|---|
| Telemetry samples and rollups | `synchronous=NORMAL`, batched. Up to ~30 s loss acceptable. |
| Audit log, paired clients, alert rules, action allow-list, settings | Committed immediately with a durable sync at the point of change. These are low-rate (a handful of writes per day), so forcing durability costs nothing in wear. |

> **Residual risk RR-10a:** Up to ~30 s of telemetry may be lost on abrupt power loss, and the gap will be visible as a discontinuity in charts and as a hole in backfill. The Agent MUST record an "unclean shutdown" marker on startup so the gap is attributable rather than mysterious. This is an accepted trade, not an oversight.

### SD-card write amplification, layer by layer

Figures below are **engineering estimates — validate with a benchmark** (measure with `iostat` extended stats and, where the card exposes it, SMART/health registers over a multi-week soak).

Logical volume first, from CANON §8 (~40 series, raw 10 s, row costs 26–32 B raw / 48–56 B rollup):

| Tier | Rows/day | Bytes/row | Logical bytes/day | Steady-state size |
|---|---|---|---|---|
| Raw, 10 s, 48 h retention | 345,600 | ~29 | **~10.0 MB** | ~20 MB |
| 1-min rollup, 30 d | 57,600 | ~52 | ~3.0 MB | ~90 MB |
| 5-min rollup, 180 d | 11,520 | ~52 | ~0.6 MB | ~108 MB |
| 1-h rollup, 2 y | 960 | ~52 | ~0.05 MB | ~36 MB |
| **Total telemetry** | | | **~13.7 MB/day** | **~254 MB (+ indexes ≈ 300–350 MB)** |

Now the amplification stack, for the **batched** configuration we chose:

| Layer | Mechanism | Multiplier | Bytes/day |
|---|---|---|---|
| 0 | Logical row bytes | 1.0× | ~14 MB |
| 1 | SQLite 4 KiB page granularity. Each 30 s batch dirties ~1 table page + 1–2 index pages; the batch itself is only ~3.5 KB, so most of a page is genuinely used. Append-ordered keys are what keep this low. | ~3.2× | ~45 MB |
| 2 | WAL write + checkpoint copy into the main database — every dirty page is written twice | 2.0× | ~90 MB |
| 3 | Filesystem (ext4, `data=ordered`, metadata journaling, `noatime`) | ~1.1× | ~100 MB |
| 4 | Flash FTL erase-block amplification. WAL appends sequentially, which is the best case for a crude FTL; a good A1 card lands around 2–3×, a poor one much worse | 2–5× | **~0.2–0.5 GB** |

**Total: roughly 0.2–0.5 GB written to NAND per day, i.e. ~70–180 GB/year.**

Against a 32 GB card with a conservative 300 effective P/E cycles across the usable capacity (~9.6 TB endurance), that is on the order of **1–2% of the card's write budget per year**. Telemetry is not what kills the card. `journald`, log files, swap, and the OS itself are larger consumers, which is why [../11-AGENT-DEPLOYMENT.md](../11-AGENT-DEPLOYMENT.md) also constrains those.

The decisive comparison is against the **naive** configuration — one transaction per sample, `synchronous=FULL`:

| Configuration | Transactions/day | NAND written/day | Ratio |
|---|---|---|---|
| **Batched 30 s, `synchronous=NORMAL`** | 2,880 | ~0.2–0.5 GB | **1×** |
| Per-sample commit, `synchronous=FULL` | 345,600 | ~4–8 GB | **~15–35×** |

Each tiny synchronous transaction forces a WAL frame flush and an FTL program cycle for a few dozen bytes of payload. At ~35×, the same card that lasts decades under our configuration would spend 15–30% of its endurance budget per year — and that is before the FTL's behaviour under small random synchronous writes, which is typically worse than the linear model suggests. **Batching is not an optimisation; it is the decision.**

> **Residual risk RR-10b:** These figures assume append-ordered inserts and a reasonably behaved FTL. A cheap or counterfeit card can amplify small writes by 10–50× and will fail years earlier. [../11-AGENT-DEPLOYMENT.md](../11-AGENT-DEPLOYMENT.md) MUST recommend a reputable A1/A2 card at minimum, and the Agent SHOULD surface cumulative bytes-written as a telemetry series so degradation is observable before it is fatal. For heavy use — short sampling intervals, many custom series, or a long audit retention — the database SHOULD be relocated to USB-SSD or, on a Pi 5, NVMe, which removes this entire risk class.

### The compression gap, honestly

SQLite has **no native time-series compression**. We store one row per sample with a per-row overhead that dwarfs the payload: a 4-byte float and a timestamp cost ~29 bytes on disk.

A Gorilla-style encoder (delta-of-delta timestamps + XOR-encoded floats, as used by Prometheus and InfluxDB) typically achieves **1.5–3 bytes per sample** on smooth machine telemetry — an **8–12× reduction** on the raw tier. We are leaving that on the table.

The available mitigation, deliberately deferred:

| | Row-per-sample (chosen for v1) | Packed BLOB blocks (Phase 2 option) |
|---|---|---|
| Layout | One row per (series, timestamp, value) | One row per (series, hour) holding a packed, compressed block of that hour's samples |
| Raw tier size | ~10 MB/day | **~1 MB/day** |
| Point/range query | Plain indexed SQL | Must locate, read, and decode whole blocks in application code |
| SQL aggregates | Work directly | Unavailable — all aggregation moves into Rust |
| Partial-hour writes | Trivial | Requires an open in-memory block plus a crash-recovery story for it |
| Retention/deletion | Row deletion by time range | Block deletion — actually *simpler* and much cheaper |
| Debuggability | Inspect with any SQLite tool | Opaque blobs; needs a bespoke dump tool |

Deferred because the v1 steady-state footprint (~300–350 MB) is unremarkable on any modern card, and because moving aggregation out of SQL into hand-written Rust is a meaningful complexity and correctness cost for a saving nobody is currently asking for. If the sampling interval drops to 1 s, or the series count grows past ~200, this becomes the right change — and note that the retention ladder already delivers most of the practical benefit by bounding the raw tier to 48 h.

### Corruption and recovery

| Situation | Response |
|---|---|
| Startup integrity check fails | Move the database aside to a timestamped quarantine file, create a fresh one, log loudly, raise an in-app notice, and **continue running**. Per P5, the Agent MUST NOT refuse to start because history was lost. |
| Disk full | Stop inserting samples, keep serving live telemetry and control, alert the Owner, and shed the oldest tier first. Never let the database wedge the Agent. |
| Unclean shutdown detected | Record a gap marker (RR-10a) and continue. |
| Database lost entirely | **Identity survives** — keys and pairing live outside the database. The Owner loses history, not access. This separation is deliberate and is the main reason database corruption is a nuisance rather than an incident. |
| Backup | Use SQLite's online backup mechanism (never a file copy of a live WAL database) to a single portable file; see [../06-DATA-MODEL.md](../06-DATA-MODEL.md) for the format and [../11-AGENT-DEPLOYMENT.md](../11-AGENT-DEPLOYMENT.md) for scheduling. |

## Consequences

### Positive

- One engine for both populations: time-series *and* the relational tables (paired clients, alert rules, audit log, settings) that a TSDB could not host. No second store, no cross-store consistency problem.
- Zero operational surface: no daemon, no port, no user, no config, no upgrade dance. Consistent with the single-static-binary goal in [ADR-0005](ADR-0005-agent-language.md).
- Extraordinary maturity. SQLite is the most-tested database in existence, with a formal crash-recovery test suite. On a device that loses power routinely, that is the property that matters most.
- Ad-hoc debuggability: any support interaction can be resolved with a standard SQLite tool against a copy of the file.
- Backfill (P5) is a single indexed range query rather than a log replay.
- `rusqlite` is mature, widely used, and can bundle SQLite so there is no system-library dependency.

### Negative

- **No native time-series compression** — ~8–12× worse than a purpose-built engine on the raw tier (mitigation deferred, above).
- **Row overhead dominates payload.** ~29 bytes to store ~8 bytes of information is inherent to a general-purpose B-tree.
- **Single-writer.** All writes serialise through one connection. Fine at 4 samples/s; it would not be fine at 1000.
- **Retention deletes are wear events.** Deleting 345,600 raw rows/day dirties pages and grows free space that must later be reclaimed. Mitigation: delete in time-ordered batches so pages are freed contiguously, and prefer incremental vacuum during idle over full vacuum, which rewrites the entire file.
- `synchronous=NORMAL` costs up to ~30 s of telemetry on power loss (RR-10a).
- Aggregation queries over long windows are B-tree scans with no columnar acceleration; the rollup ladder exists precisely to keep those windows small, and chart queries MUST select the appropriate tier rather than scanning raw data.

### Neutral

- The rollup ladder is application logic either way — no candidate engine would have given us the exact ladder in CANON §8 for free.
- Moving the database to USB-SSD or NVMe is a configuration change, not a redesign, and eliminates the entire wear discussion for users who care.
- The chosen page size and batching interval are tunables, so the wear profile can be adjusted in the field without a schema change.

## Alternatives considered

| Option | Why rejected |
|---|---|
| **Flat append-only log files + in-memory index** | The lowest possible write amplification (pure sequential appends, ~1.05× at the filesystem layer) and the fastest writes. Rejected because it is a database we would have to finish writing: range queries, rollup compaction, retention, crash recovery, torn-write detection, index rebuild on startup, and concurrent read/write safety are all ours. That is months of work reimplementing the parts of SQLite that are hardest to get right, and it still leaves the relational tables homeless. The wear advantage over batched WAL-mode SQLite is roughly 2–3×, against a baseline already consuming ~1–2% of card endurance per year — not worth it. |
| **Embedded TSDB (Gorilla-style engine, or a Rust TSDB crate)** | The right data model and 8–12× better compression. Rejected: the Rust embedded-TSDB ecosystem is immature and none is a safe bet for a daemon that must survive unattended power loss for years. It also solves only the time-series half of the problem, so SQLite (or equivalent) would be needed *as well* — two engines, two crash-recovery stories, two backup formats. The compression benefit is available later inside SQLite via packed blocks without adding a dependency. |
| **RocksDB as a KV base** | Mature, battle-tested, excellent write throughput. **Rejected decisively on write amplification:** LSM compaction rewrites data repeatedly, with typical amplification of 10–30× — the exact opposite of what an SD card needs. It is also a large C++ dependency that conflicts with the single-static-binary goal, and its memory footprint is unfriendly on a 2 GB Pi. Structurally the wrong shape for this medium. |
| **`sled` or `redb`** | Pure-Rust embedded KV stores, attractive for dependency hygiene. Rejected: `sled` has been in beta for years with known unresolved concerns and an explicit "not production ready" posture; `redb` is younger and, while promising, does not have SQLite's decades of crash-recovery evidence. Both are KV stores, so range queries, aggregation, and the relational tables would still be built by hand. |
| **Prometheus / VictoriaMetrics on the Pi** | Purpose-built, excellent compression, mature query language. Rejected: a separate daemon with its own port, config, memory footprint (hundreds of MB), and upgrade path, on a device where the Agent is supposed to be one binary and one unit file. Also pull-model and network-oriented — architecturally wrong for an embedded component. |
| **PostgreSQL / TimescaleDB / InfluxDB** | Far too heavy for a 2–8 GB Pi. Multi-hundred-MB resident sets, tuning burden, and an operational surface larger than the entire rest of the product. Non-starter. |
| **In-memory only, with the Client as the store** | Zero wear and zero storage cost. **Rejected: violates P4 (the Pi is the source of truth) and P5 (keep recording while offline).** History would vanish on every reboot and would not survive losing the phone. |
| **SQLite with `synchronous=FULL`** | Stronger durability. Rejected: ~15–35× the flash writes for the sake of the last 30 s of a temperature chart. Retained selectively for the audit log and pairing tables, where the write rate is negligible and the data actually matters. |
| **SQLite in-memory with periodic snapshot to disk** | Very low wear. Rejected: loses everything since the last snapshot on power loss (much worse than 30 s), needs RAM proportional to retention on a memory-constrained device, and complicates backfill. WAL-mode batching already captures most of the wear benefit at a fraction of the risk. |

## Revisit if

- **Sampling interval drops below ~5 s, or default series count exceeds ~200.** Logical volume scales linearly; at ~10× the current rate the packed-BLOB compression work becomes worthwhile, and the batching interval should be re-tuned.
- **Field data shows SD-card failures correlated with Agent installs.** That would falsify the amplification model above and should trigger real measurement (RR-10b) before any redesign — the likely culprit is card quality or `journald`, not the sample table.
- **Pi 5 NVMe becomes the common deployment.** The entire wear analysis becomes moot, `synchronous=FULL` becomes affordable, and the batching interval could shrink to improve durability at no cost.
- **A mature, crash-tested pure-Rust TSDB appears.** Specifically one with a documented crash-recovery test suite comparable to SQLite's — anything less does not clear the bar for an unattended daemon on an unreliable power supply.
- **Multi-Pi aggregation enters scope.** Storing several Agents' history on one device changes the volume, the query shape, and possibly the engine choice. v1 assumes one Agent per database.
- **The audit log grows to the point of dominating storage.** It is currently assumed low-rate; a chatty audit policy (e.g. per-input-event logging) would change the arithmetic substantially and would need its own retention tier.
