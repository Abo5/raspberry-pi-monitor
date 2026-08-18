import { backtestSpans } from '../lib/backtest';
import { Sample } from '../types';

// Build a series at a fixed 10s cadence from a list of values.
function series(values: number[], stepS = 10, t0 = 1_000_000): Sample[] {
  return values.map((v, i) => ({ t: t0 + i * stepS * 1000, v }));
}

describe('backtestSpans', () => {
  const rule = { op: 'above' as const, threshold: 80, dwellS: 30 };

  it('finds no spans when nothing crosses', () => {
    const s = series([10, 20, 30, 40]);
    expect(backtestSpans(s, rule, 2_000_000)).toHaveLength(0);
  });

  it('ignores a crossing shorter than the dwell', () => {
    // over for two samples = ~10s of holding before it drops (< 30s dwell)
    const s = series([10, 85, 86, 10, 10]);
    expect(backtestSpans(s, rule, 2_000_000)).toHaveLength(0);
  });

  it('counts a crossing that holds past the dwell', () => {
    // over from index 1..5 then drops at 6: held ~50s >= 30s
    const s = series([10, 85, 86, 88, 90, 87, 10]);
    const spans = backtestSpans(s, rule, 9_000_000);
    expect(spans).toHaveLength(1);
    expect(spans[0].from).toBe(s[1].t);
    expect(spans[0].to).toBe(s[6].t);
  });

  it('counts two separate qualifying spans', () => {
    const s = series([85, 86, 87, 88, 10, 10, 91, 92, 93, 94, 10]);
    const spans = backtestSpans(s, rule, 9_000_000);
    expect(spans).toHaveLength(2);
  });

  it('closes an open run at endNow when it has held long enough', () => {
    const s = series([10, 85, 86, 87, 88]); // still over at the end
    const endNow = s[s.length - 1].t + 60_000;
    const spans = backtestSpans(s, rule, endNow);
    expect(spans).toHaveLength(1);
    expect(spans[0].to).toBe(endNow);
  });

  it('drops an open run at endNow that has not held long enough', () => {
    const s = series([10, 10, 10, 85]); // only the last sample is over
    const endNow = s[s.length - 1].t + 5_000; // 5s < 30s dwell
    expect(backtestSpans(s, rule, endNow)).toHaveLength(0);
  });
});
