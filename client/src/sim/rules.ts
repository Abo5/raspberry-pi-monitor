// Pure alert-rule state machine, shared by the simulated tunnel and the tests.
// Keeping the decision logic free of timers and the store makes the dwell /
// fire / resolve behaviour (docs/07 §13, design decision 6) unit-testable.
import { AlertRule } from '../types';

export type RuleDecision =
  | { kind: 'none'; overSince: number | null }
  | { kind: 'fire'; overSince: number }
  | { kind: 'update-peak'; overSince: number }
  | { kind: 'resolve'; overSince: null };

/** Whether the predicate holds right now, independent of dwell. */
export function isFiring(rule: Pick<AlertRule, 'op' | 'threshold'>, value: number): boolean {
  return rule.op === 'above' ? value > rule.threshold : value < rule.threshold;
}

/**
 * One evaluation step for a single rule.
 * @param overSince  epoch ms the predicate first became true (null if not currently over)
 * @param open       the currently-open (unresolved) alert for this rule, if any
 */
export function ruleTransition(
  rule: Pick<AlertRule, 'op' | 'threshold' | 'dwellS'>,
  value: number,
  now: number,
  overSince: number | null,
  open: { peak: { v: number } } | undefined,
): RuleDecision {
  const firing = isFiring(rule, value);

  if (firing) {
    const since = overSince ?? now;
    const heldS = (now - since) / 1000;
    if (!open && heldS >= rule.dwellS) return { kind: 'fire', overSince: since };
    // A new extreme in the firing direction refreshes the alert's peak.
    if (open) {
      const isNewExtreme = (value > open.peak.v) === (rule.op === 'above');
      if (isNewExtreme) return { kind: 'update-peak', overSince: since };
    }
    return { kind: 'none', overSince: since };
  }

  // Not firing: clear the dwell clock; resolve an open alert.
  if (open) return { kind: 'resolve', overSince: null };
  return { kind: 'none', overSince: null };
}
