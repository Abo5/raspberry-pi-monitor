// Formatting rules per docs/07-UX-SPEC §18: always a unit, sensor-matched
// precision, auto-scaled bytes, humane durations.
import { fmtBps, fmtBytes, fmtDuration, fmtPct, fmtRelative, fmtTemp, fmtValue } from '../lib/format';

describe('fmtPct', () => {
  it('uses 1 dp under 10', () => expect(fmtPct(9.44)).toBe('9.4'));
  it('uses 0 dp at 10 and above', () => expect(fmtPct(38.6)).toBe('39'));
});

describe('fmtTemp', () => {
  it('always 1 dp', () => expect(fmtTemp(54)).toBe('54.0'));
});

describe('fmtBytes', () => {
  it('scales to KB', () => expect(fmtBytes(84_000)).toEqual({ value: '84.0', unit: 'KB' }));
  it('scales to MB with 3 significant figures', () =>
    expect(fmtBytes(1_580_000)).toEqual({ value: '1.58', unit: 'MB' }));
  it('scales to GB', () => expect(fmtBytes(8_000_000_000).unit).toBe('GB'));
});

describe('fmtBps', () => {
  it('appends /s', () => expect(fmtBps(1_200_000).unit).toBe('MB/s'));
});

describe('fmtDuration', () => {
  it('seconds under 90 s', () => expect(fmtDuration(50)).toBe('50 s'));
  it('minutes', () => expect(fmtDuration(240)).toBe('4 min'));
  it('hours', () => expect(fmtDuration(7200)).toBe('2 h'));
  it('days', () => expect(fmtDuration(14 * 86400)).toBe('14 d'));
});

describe('fmtRelative', () => {
  const now = 1_800_000_000_000;
  it('now under a minute', () => expect(fmtRelative(now - 30_000, now)).toBe('now'));
  it('minutes', () => expect(fmtRelative(now - 4 * 60_000, now)).toBe('4m'));
  it('hours', () => expect(fmtRelative(now - 3 * 3_600_000, now)).toBe('3h'));
  it('absolute after 7 days', () =>
    expect(fmtRelative(now - 10 * 86_400_000, now)).toMatch(/\d+ \w+/));
});

describe('fmtValue', () => {
  it('temperature carries °C at 1 dp', () =>
    expect(fmtValue('cpu.temp_c', 54.23)).toEqual({ value: '54.2', unit: '°C' }));
  it('percent series carry %', () => expect(fmtValue('mem.used_pct', 38).unit).toBe('%'));
  it('load has 2 dp and no unit', () =>
    expect(fmtValue('load.1m', 1.5)).toEqual({ value: '1.50', unit: '' }));
});
