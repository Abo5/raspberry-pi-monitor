// The simulated Agent's metric generator: deterministic in t (history and live
// Snapshots must agree — design decision mirrored from the real Agent being
// the source of truth), and bounded to physically plausible ranges.
import { metricValue, rollupNote, sampleSeries, SERIES } from '../sim/metrics';
import { SeriesKey } from '../types';

const T = 1_800_000_000_000;

describe('metricValue', () => {
  it('is deterministic: same series, same t, same value', () => {
    (Object.keys(SERIES) as SeriesKey[]).forEach((k) => {
      expect(metricValue(k, T)).toBe(metricValue(k, T));
    });
  });

  it('keeps CPU utilisation within 0.5–99 %', () => {
    for (let i = 0; i < 200; i++) {
      const v = metricValue('cpu.util_pct', T + i * 60_000);
      expect(v).toBeGreaterThanOrEqual(0.5);
      expect(v).toBeLessThanOrEqual(99);
    }
  });

  it('keeps SoC temperature within 38–88 °C', () => {
    for (let i = 0; i < 200; i++) {
      const v = metricValue('cpu.temp_c', T + i * 60_000);
      expect(v).toBeGreaterThanOrEqual(38);
      expect(v).toBeLessThanOrEqual(88);
    }
  });

  it('correlates temperature with load (physical plausibility)', () => {
    // Averaged over many points, hotter samples should coincide with higher load.
    let hotLoad = 0;
    let coldLoad = 0;
    let hot = 0;
    let cold = 0;
    for (let i = 0; i < 500; i++) {
      const t = T + i * 137_000;
      const temp = metricValue('cpu.temp_c', t);
      const load = metricValue('cpu.util_pct', t);
      if (temp > 60) {
        hotLoad += load;
        hot++;
      } else if (temp < 52) {
        coldLoad += load;
        cold++;
      }
    }
    if (hot > 0 && cold > 0) {
      expect(hotLoad / hot).toBeGreaterThan(coldLoad / cold);
    }
  });

  it('uptime grows monotonically', () => {
    expect(metricValue('sys.uptime_s', T + 60_000)).toBeGreaterThan(metricValue('sys.uptime_s', T));
  });
});

describe('sampleSeries', () => {
  it('returns points+1 samples spanning [from, to]', () => {
    const s = sampleSeries('cpu.temp_c', T, T + 3_600_000, 60);
    expect(s).toHaveLength(61);
    expect(s[0].t).toBe(T);
    expect(s[60].t).toBe(T + 3_600_000);
  });
});

describe('rollupNote (design decision 4: every response states its tier)', () => {
  it('10-second samples up to 1h', () => expect(rollupNote(3_600_000)).toBe('10-second samples'));
  it('1-minute averages up to 24h', () => expect(rollupNote(24 * 3_600_000)).toBe('1-minute averages'));
  it('10-minute averages up to 7d', () => expect(rollupNote(7 * 24 * 3_600_000)).toBe('10-minute averages'));
  it('1-hour averages beyond', () => expect(rollupNote(30 * 24 * 3_600_000)).toBe('1-hour averages'));
});
