// Alert rule state machine (docs/07 §13): dwell before firing, one open alert,
// peak tracking, resolve when the predicate clears.
import { isFiring, ruleTransition } from '../sim/rules';

const above = { op: 'above' as const, threshold: 80, dwellS: 90 };
const below = { op: 'below' as const, threshold: 10, dwellS: 30 };

describe('isFiring', () => {
  it('above: strictly greater', () => {
    expect(isFiring(above, 80.1)).toBe(true);
    expect(isFiring(above, 80)).toBe(false);
    expect(isFiring(above, 79)).toBe(false);
  });
  it('below: strictly less', () => {
    expect(isFiring(below, 9)).toBe(true);
    expect(isFiring(below, 10)).toBe(false);
  });
});

describe('ruleTransition — dwell', () => {
  it('does not fire before the dwell has elapsed', () => {
    const t0 = 1_000_000;
    // first over-threshold sample starts the clock, no open alert
    const d1 = ruleTransition(above, 83, t0, null, undefined);
    expect(d1).toEqual({ kind: 'none', overSince: t0 });
    // 89s later — still under dwell (90s)
    const d2 = ruleTransition(above, 84, t0 + 89_000, d1.overSince, undefined);
    expect(d2.kind).toBe('none');
  });

  it('fires exactly at the dwell boundary', () => {
    const t0 = 1_000_000;
    const d = ruleTransition(above, 83, t0 + 90_000, t0, undefined);
    expect(d.kind).toBe('fire');
    expect(d.overSince).toBe(t0);
  });

  it('starts the dwell clock fresh when overSince was null', () => {
    const now = 5_000_000;
    const d = ruleTransition(above, 90, now, null, undefined);
    expect(d).toEqual({ kind: 'none', overSince: now });
  });
});

describe('ruleTransition — open alert', () => {
  const open = { peak: { v: 83 } };
  it('updates the peak on a new extreme (above)', () => {
    const d = ruleTransition(above, 85, 2_000_000, 1_000_000, open);
    expect(d.kind).toBe('update-peak');
  });
  it('does not update the peak when the value is not a new extreme', () => {
    const d = ruleTransition(above, 81, 2_000_000, 1_000_000, open);
    expect(d.kind).toBe('none');
  });
  it('never fires a second alert while one is open', () => {
    const d = ruleTransition(above, 99, 9_000_000, 1_000_000, open);
    expect(d.kind).not.toBe('fire');
  });
});

describe('ruleTransition — resolve', () => {
  const open = { peak: { v: 83 } };
  it('resolves an open alert when the predicate clears', () => {
    const d = ruleTransition(above, 70, 3_000_000, 1_000_000, open);
    expect(d).toEqual({ kind: 'resolve', overSince: null });
  });
  it('clears the dwell clock when not firing and nothing is open', () => {
    const d = ruleTransition(above, 70, 3_000_000, 1_000_000, undefined);
    expect(d).toEqual({ kind: 'none', overSince: null });
  });
  it('below-threshold rules resolve symmetrically', () => {
    const d = ruleTransition(below, 15, 100, 50, { peak: { v: 4 } });
    expect(d.kind).toBe('resolve');
  });
});
