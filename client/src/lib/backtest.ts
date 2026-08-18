// Pure backtest: given a series and a rule predicate, find the spans that WOULD
// have fired (predicate held continuously for at least the dwell). Powers the
// rule editor's "would have fired N times" preview (docs/07 §13.3, decision 6).
// Operates on whatever samples it is given — on a paired Pi those come from the
// Agent's real /series history.
import { Sample } from '../types';

export interface FiredSpan {
  from: number;
  to: number;
}

/** Whether the predicate holds right now, independent of dwell. */
export function isFiring(rule: { op: 'above' | 'below'; threshold: number }, value: number): boolean {
  return rule.op === 'above' ? value > rule.threshold : value < rule.threshold;
}

export function backtestSpans(
  samples: Sample[],
  rule: { op: 'above' | 'below'; threshold: number; dwellS: number },
  endNow: number,
): FiredSpan[] {
  const spans: FiredSpan[] = [];
  let start: number | null = null;
  for (const s of samples) {
    if (isFiring(rule, s.v)) {
      if (start == null) start = s.t;
    } else if (start != null) {
      if ((s.t - start) / 1000 >= rule.dwellS) spans.push({ from: start, to: s.t });
      start = null;
    }
  }
  // A run still open at the end of the window counts if it has held long enough.
  if (start != null && (endNow - start) / 1000 >= rule.dwellS) {
    spans.push({ from: start, to: endNow });
  }
  return spans;
}
