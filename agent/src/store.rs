//! Persistent time-series store (Phase 2) — SQLite via rusqlite.
//!
//! Raw samples are appended per series; `/series` queries downsample on read
//! (bucketed averages) and report the resolution they used. Retention prunes
//! old rows. Alert history and rules are persisted here too. The latest
//! snapshot is also kept in memory for the live stream + `/snapshot`.

use std::sync::{Arc, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};

use anyhow::Result;
use rusqlite::Connection;
use serde::{Deserialize, Serialize};

use crate::metrics::Values;

pub fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Snapshot {
    pub produced_at: i64,
    pub stale_after: u64,
    pub very_stale_after: u64,
    pub values: Values,
}

#[derive(Clone, Serialize)]
pub struct Sample {
    pub t: i64,
    pub v: f64,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct Rule {
    pub id: String,
    #[serde(rename = "seriesKey")]
    pub series_key: String,
    pub op: String, // "above" | "below"
    pub threshold: f64,
    #[serde(rename = "dwellS")]
    pub dwell_s: f64,
    pub severity: String,
    pub enabled: bool,
    pub notify: bool,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Alert {
    pub id: String,
    pub rule_id: String,
    pub series_key: String,
    pub severity: String,
    pub title: String,
    pub fired_at: i64,
    pub resolved_at: Option<i64>,
    pub peak_v: f64,
    pub peak_t: i64,
}

#[derive(Clone)]
pub struct Store {
    conn: Arc<Mutex<Connection>>,
    latest: Arc<Mutex<Option<Snapshot>>>,
    retention_ms: i64,
    writes: Arc<Mutex<u64>>,
}

impl Store {
    pub fn open(path: &str, retention_days: u32) -> Result<Self> {
        let conn = Connection::open(path)?;
        conn.execute_batch(
            "PRAGMA journal_mode=WAL;
             PRAGMA synchronous=NORMAL;
             CREATE TABLE IF NOT EXISTS sample (series TEXT NOT NULL, t INTEGER NOT NULL, v REAL NOT NULL);
             CREATE INDEX IF NOT EXISTS idx_sample ON sample(series, t);
             CREATE TABLE IF NOT EXISTS alert (
                id TEXT PRIMARY KEY, rule_id TEXT, series TEXT, severity TEXT, title TEXT,
                fired_at INTEGER, resolved_at INTEGER, peak_v REAL, peak_t INTEGER);
             CREATE TABLE IF NOT EXISTS rule (
                id TEXT PRIMARY KEY, series TEXT, op TEXT, threshold REAL, dwell_s REAL,
                severity TEXT, enabled INTEGER, notify INTEGER);",
        )?;
        Ok(Store {
            conn: Arc::new(Mutex::new(conn)),
            latest: Arc::new(Mutex::new(None)),
            retention_ms: retention_days as i64 * 86_400_000,
            writes: Arc::new(Mutex::new(0)),
        })
    }

    pub fn push(&self, snap: Snapshot) {
        {
            let conn = self.conn.lock().unwrap();
            let tx = conn.unchecked_transaction();
            if let Ok(tx) = tx {
                {
                    let mut stmt = tx
                        .prepare_cached("INSERT INTO sample (series, t, v) VALUES (?1, ?2, ?3)")
                        .unwrap();
                    for (k, v) in &snap.values {
                        let _ = stmt.execute(rusqlite::params![k, snap.produced_at, v]);
                    }
                }
                let _ = tx.commit();
            }
        }
        *self.latest.lock().unwrap() = Some(snap);

        // Periodic retention prune (every ~200 writes).
        let mut w = self.writes.lock().unwrap();
        *w += 1;
        if *w % 200 == 0 {
            let cutoff = now_ms() - self.retention_ms;
            let conn = self.conn.lock().unwrap();
            let _ = conn.execute("DELETE FROM sample WHERE t < ?1", rusqlite::params![cutoff]);
        }
    }

    pub fn latest(&self) -> Option<Snapshot> {
        self.latest.lock().unwrap().clone()
    }

    /// Bucketed-average history. Returns (rollup label, samples).
    pub fn series(&self, key: &str, from: i64, to: i64, target_points: i64) -> (String, Vec<Sample>) {
        let span = (to - from).max(1);
        let bucket = (span / target_points.max(1)).max(1000); // >= 1s buckets
        let rollup = rollup_label(bucket);
        let conn = self.conn.lock().unwrap();
        let mut stmt = match conn.prepare_cached(
            "SELECT (t/?4)*?4 AS bt, AVG(v) FROM sample
             WHERE series=?1 AND t>=?2 AND t<=?3 GROUP BY bt ORDER BY bt",
        ) {
            Ok(s) => s,
            Err(_) => return (rollup, vec![]),
        };
        let rows = stmt.query_map(rusqlite::params![key, from, to, bucket], |r| {
            Ok(Sample { t: r.get::<_, i64>(0)?, v: r.get::<_, f64>(1)? })
        });
        let mut out = vec![];
        if let Ok(rows) = rows {
            for row in rows.flatten() {
                out.push(row);
            }
        }
        (rollup, out)
    }

    // ---- rules ----
    pub fn rules(&self) -> Vec<Rule> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = match conn
            .prepare("SELECT id, series, op, threshold, dwell_s, severity, enabled, notify FROM rule")
        {
            Ok(s) => s,
            Err(_) => return vec![],
        };
        let rows = stmt.query_map([], |r| {
            Ok(Rule {
                id: r.get(0)?,
                series_key: r.get(1)?,
                op: r.get(2)?,
                threshold: r.get(3)?,
                dwell_s: r.get(4)?,
                severity: r.get(5)?,
                enabled: r.get::<_, i64>(6)? != 0,
                notify: r.get::<_, i64>(7)? != 0,
            })
        });
        rows.map(|rs| rs.flatten().collect()).unwrap_or_default()
    }

    pub fn upsert_rule(&self, rule: &Rule) {
        let conn = self.conn.lock().unwrap();
        let _ = conn.execute(
            "INSERT INTO rule (id, series, op, threshold, dwell_s, severity, enabled, notify)
             VALUES (?1,?2,?3,?4,?5,?6,?7,?8)
             ON CONFLICT(id) DO UPDATE SET series=?2, op=?3, threshold=?4, dwell_s=?5,
               severity=?6, enabled=?7, notify=?8",
            rusqlite::params![
                rule.id, rule.series_key, rule.op, rule.threshold, rule.dwell_s,
                rule.severity, rule.enabled as i64, rule.notify as i64
            ],
        );
    }

    pub fn delete_rule(&self, id: &str) {
        let conn = self.conn.lock().unwrap();
        let _ = conn.execute("DELETE FROM rule WHERE id=?1", rusqlite::params![id]);
    }

    // ---- alerts ----
    pub fn open_alert_for(&self, rule_id: &str) -> Option<Alert> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn
            .prepare_cached(
                "SELECT id, rule_id, series, severity, title, fired_at, resolved_at, peak_v, peak_t
                 FROM alert WHERE rule_id=?1 AND resolved_at IS NULL LIMIT 1",
            )
            .ok()?;
        stmt.query_row(rusqlite::params![rule_id], row_to_alert).ok()
    }

    pub fn insert_alert(&self, a: &Alert) {
        let conn = self.conn.lock().unwrap();
        let _ = conn.execute(
            "INSERT INTO alert (id, rule_id, series, severity, title, fired_at, resolved_at, peak_v, peak_t)
             VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9)",
            rusqlite::params![a.id, a.rule_id, a.series_key, a.severity, a.title, a.fired_at, a.resolved_at, a.peak_v, a.peak_t],
        );
    }

    pub fn update_alert_peak(&self, id: &str, v: f64, t: i64) {
        let conn = self.conn.lock().unwrap();
        let _ = conn.execute("UPDATE alert SET peak_v=?2, peak_t=?3 WHERE id=?1", rusqlite::params![id, v, t]);
    }

    pub fn resolve_alert(&self, id: &str, at: i64) {
        let conn = self.conn.lock().unwrap();
        let _ = conn.execute("UPDATE alert SET resolved_at=?2 WHERE id=?1", rusqlite::params![id, at]);
    }

    pub fn alerts(&self, limit: i64) -> Vec<Alert> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = match conn.prepare(
            "SELECT id, rule_id, series, severity, title, fired_at, resolved_at, peak_v, peak_t
             FROM alert ORDER BY fired_at DESC LIMIT ?1",
        ) {
            Ok(s) => s,
            Err(_) => return vec![],
        };
        let rows = stmt.query_map(rusqlite::params![limit], row_to_alert);
        rows.map(|rs| rs.flatten().collect()).unwrap_or_default()
    }
}

fn row_to_alert(r: &rusqlite::Row) -> rusqlite::Result<Alert> {
    Ok(Alert {
        id: r.get(0)?,
        rule_id: r.get(1)?,
        series_key: r.get(2)?,
        severity: r.get(3)?,
        title: r.get(4)?,
        fired_at: r.get(5)?,
        resolved_at: r.get(6)?,
        peak_v: r.get(7)?,
        peak_t: r.get(8)?,
    })
}

fn rollup_label(bucket_ms: i64) -> String {
    if bucket_ms <= 15_000 {
        "raw".into()
    } else if bucket_ms < 600_000 {
        format!("{}-second averages", bucket_ms / 1000)
    } else if bucket_ms < 3_600_000 {
        format!("{}-minute averages", bucket_ms / 60_000)
    } else {
        format!("{}-hour averages", (bucket_ms / 3_600_000).max(1))
    }
}
