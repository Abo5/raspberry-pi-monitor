//! Alert rule evaluation (mirrors client/src/sim/rules.ts): fire after the
//! predicate holds for the dwell, track the peak, resolve when it clears.
//! Alert history is persisted in the store (authoritative).

use std::collections::HashMap;

use crate::metrics::Values;
use crate::store::{Alert, Rule, Store};

#[derive(Default)]
pub struct RuleState {
    over_since: HashMap<String, i64>, // rule_id -> epoch ms the predicate first held
}

impl RuleState {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn evaluate(&mut self, store: &Store, values: &Values, now: i64) {
        for rule in store.rules() {
            if !rule.enabled {
                continue;
            }
            let Some(&v) = values.get(&rule.series_key) else { continue };
            let firing = if rule.op == "below" { v < rule.threshold } else { v > rule.threshold };
            let open = store.open_alert_for(&rule.id);

            if firing {
                let since = *self.over_since.entry(rule.id.clone()).or_insert(now);
                let held_s = (now - since) as f64 / 1000.0;
                if open.is_none() && held_s >= rule.dwell_s {
                    let a = make_alert(&rule, v, now);
                    store.insert_alert(&a);
                    tracing::warn!("alert fired: {}", a.title);
                } else if let Some(open) = open {
                    let new_extreme = (v > open.peak_v) == (rule.op != "below");
                    if new_extreme {
                        store.update_alert_peak(&open.id, v, now);
                    }
                }
            } else {
                self.over_since.remove(&rule.id);
                if let Some(open) = open {
                    store.resolve_alert(&open.id, now);
                    tracing::info!("alert resolved: {}", open.title);
                }
            }
        }
    }
}

pub fn make_alert(rule: &Rule, v: f64, now: i64) -> Alert {
    Alert {
        id: format!("al-{now}-{}", rule.id),
        rule_id: rule.id.clone(),
        series_key: rule.series_key.clone(),
        severity: rule.severity.clone(),
        title: alert_title(rule),
        fired_at: now,
        resolved_at: None,
        peak_v: v,
        peak_t: now,
    }
}

pub fn alert_title(rule: &Rule) -> String {
    let op = if rule.op == "below" { "below" } else { "above" };
    format!("{} {} {}", rule.series_key, op, rule.threshold)
}

/// Backtest: spans in the given samples where the predicate held ≥ dwell.
pub fn backtest(samples: &[crate::store::Sample], op: &str, threshold: f64, dwell_s: f64, end_now: i64) -> Vec<(i64, i64)> {
    let mut spans = vec![];
    let mut start: Option<i64> = None;
    for s in samples {
        let firing = if op == "below" { s.v < threshold } else { s.v > threshold };
        if firing {
            if start.is_none() {
                start = Some(s.t);
            }
        } else if let Some(st) = start {
            if (s.t - st) as f64 / 1000.0 >= dwell_s {
                spans.push((st, s.t));
            }
            start = None;
        }
    }
    if let Some(st) = start {
        if (end_now - st) as f64 / 1000.0 >= dwell_s {
            spans.push((st, end_now));
        }
    }
    spans
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::store::Sample;

    fn series(vals: &[f64], step_s: i64, t0: i64) -> Vec<Sample> {
        vals.iter().enumerate().map(|(i, &v)| Sample { t: t0 + i as i64 * step_s * 1000, v }).collect()
    }

    #[test]
    fn no_crossing_no_spans() {
        let s = series(&[10.0, 20.0, 30.0], 10, 1_000_000);
        assert_eq!(backtest(&s, "above", 80.0, 30.0, 2_000_000).len(), 0);
    }

    #[test]
    fn short_crossing_ignored() {
        // over for ~10s then drops, dwell 30s → no span
        let s = series(&[10.0, 85.0, 86.0, 10.0, 10.0], 10, 1_000_000);
        assert_eq!(backtest(&s, "above", 80.0, 30.0, 9_000_000).len(), 0);
    }

    #[test]
    fn held_crossing_counts() {
        let s = series(&[10.0, 85.0, 86.0, 88.0, 90.0, 87.0, 10.0], 10, 1_000_000);
        let spans = backtest(&s, "above", 80.0, 30.0, 9_000_000);
        assert_eq!(spans.len(), 1);
        assert_eq!(spans[0].0, s[1].t);
        assert_eq!(spans[0].1, s[6].t);
    }

    #[test]
    fn below_predicate_and_open_run_at_end() {
        let s = series(&[50.0, 5.0, 4.0, 3.0], 10, 1_000_000); // below 10 from idx1, still open
        let end = s[s.len() - 1].t + 60_000;
        let spans = backtest(&s, "below", 10.0, 20.0, end);
        assert_eq!(spans.len(), 1);
        assert_eq!(spans[0].1, end);
    }
}
