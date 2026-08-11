// Series metadata + rollup tiers (design decision 4: every response states its
// resolution tier).
import { rollupNote, SERIES } from '../lib/series';
import { SeriesKey } from '../types';

describe('SERIES catalog', () => {
  it('covers every series key with label, title and decimals', () => {
    (Object.keys(SERIES) as SeriesKey[]).forEach((k) => {
      const m = SERIES[k];
      expect(m.key).toBe(k);
      expect(m.label.length).toBeGreaterThan(0);
      expect(m.title.length).toBeGreaterThan(0);
      expect(m.decimals).toBeGreaterThanOrEqual(0);
    });
  });

  it('states the thermal-throttle thresholds on SoC temperature', () => {
    expect(SERIES['cpu.temp_c'].hardThresholds).toEqual({ soft: 80, hard: 85 });
  });
});

describe('rollupNote (design decision 4: every response states its tier)', () => {
  it('10-second samples up to 1h', () => expect(rollupNote(3_600_000)).toBe('10-second samples'));
  it('1-minute averages up to 24h', () => expect(rollupNote(24 * 3_600_000)).toBe('1-minute averages'));
  it('10-minute averages up to 7d', () => expect(rollupNote(7 * 24 * 3_600_000)).toBe('10-minute averages'));
  it('1-hour averages beyond', () => expect(rollupNote(30 * 24 * 3_600_000)).toBe('1-hour averages'));
});
