//! In-memory recent-history ring (Phase 1). Phase 2 replaces this with the
//! SQLite time-series store + retention/downsampling from the data-model doc.

use std::collections::VecDeque;
use std::sync::{Arc, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};

use serde::Serialize;

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

#[derive(Clone)]
pub struct Store {
    inner: Arc<Mutex<Inner>>,
    cap: usize,
}

struct Inner {
    history: VecDeque<Snapshot>,
    latest: Option<Snapshot>,
}

impl Store {
    pub fn new(cap: usize) -> Self {
        Store {
            inner: Arc::new(Mutex::new(Inner { history: VecDeque::new(), latest: None })),
            cap,
        }
    }

    pub fn push(&self, snap: Snapshot) {
        let mut g = self.inner.lock().unwrap();
        g.latest = Some(snap.clone());
        g.history.push_back(snap);
        while g.history.len() > self.cap {
            g.history.pop_front();
        }
    }

    pub fn latest(&self) -> Option<Snapshot> {
        self.inner.lock().unwrap().latest.clone()
    }

    /// Samples of one series within [from, to], as {t, v}.
    pub fn series(&self, key: &str, from: i64, to: i64) -> Vec<Sample> {
        let g = self.inner.lock().unwrap();
        g.history
            .iter()
            .filter(|s| s.produced_at >= from && s.produced_at <= to)
            .filter_map(|s| s.values.get(key).map(|v| Sample { t: s.produced_at, v: *v }))
            .collect()
    }
}

#[derive(Clone, Serialize)]
pub struct Sample {
    pub t: i64,
    pub v: f64,
}
