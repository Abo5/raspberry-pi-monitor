// Deterministic smooth metric generator. History and live Snapshots come from
// the same function of time, so charts, sparklines and tiles always agree —
// the same property the real Agent provides by being the source of truth.
import { SeriesKey, SeriesMeta, Sample } from '../types';

export const SERIES: Record<SeriesKey, SeriesMeta> = {
  'cpu.temp_c': { key: 'cpu.temp_c', label: 'SOC TEMP', title: 'SoC temperature', unit: '°C', decimals: 1, hardThresholds: { soft: 80, hard: 85 } },
  'cpu.util_pct': { key: 'cpu.util_pct', label: 'CPU', title: 'CPU utilisation', unit: '%', decimals: 1 },
  'cpu.freq_mhz': { key: 'cpu.freq_mhz', label: 'CLOCK', title: 'ARM clock', unit: 'MHz', decimals: 0 },
  'mem.used_pct': { key: 'mem.used_pct', label: 'MEMORY', title: 'Memory used', unit: '%', decimals: 0 },
  'mem.available_bytes': { key: 'mem.available_bytes', label: 'MEM FREE', title: 'Memory available', unit: 'B', decimals: 0 },
  'disk.used_pct': { key: 'disk.used_pct', label: 'DISK /', title: 'Disk / used', unit: '%', decimals: 0 },
  'net.rx_bps': { key: 'net.rx_bps', label: 'RX', title: 'Network receive', unit: 'B/s', decimals: 0 },
  'net.tx_bps': { key: 'net.tx_bps', label: 'TX', title: 'Network transmit', unit: 'B/s', decimals: 0 },
  'load.1m': { key: 'load.1m', label: 'LOAD 1M', title: 'Load average (1 min)', unit: '', decimals: 2 },
  'sys.uptime_s': { key: 'sys.uptime_s', label: 'UPTIME', title: 'Uptime', unit: '', decimals: 0 },
};

// Smooth pseudo-noise: sum of incommensurate sines. Deterministic in t.
function noise(t: number, seed: number, periodsMin: number[]): number {
  let v = 0;
  let w = 0;
  for (let i = 0; i < periodsMin.length; i++) {
    const p = periodsMin[i] * 60_000;
    const amp = 1 / (i + 1);
    v += amp * Math.sin((t / p) * 2 * Math.PI + seed * (i + 1) * 1.7);
    w += amp;
  }
  return v / w; // -1..1
}

const BOOT_T = Date.now() - 14 * 86_400_000; // "up 14 days"

export function metricValue(key: SeriesKey, t: number, seed = 1): number {
  switch (key) {
    case 'cpu.util_pct': {
      const base = 12 + 8 * noise(t, seed + 1, [3, 17, 61]);
      const spike = noise(t, seed + 9, [7]) > 0.82 ? 35 : 0;
      return clamp(base + spike, 0.5, 99);
    }
    case 'cpu.temp_c': {
      const load = metricValue('cpu.util_pct', t, seed);
      return clamp(48 + load * 0.22 + 3 * noise(t, seed + 2, [11, 43]), 38, 88);
    }
    case 'cpu.freq_mhz': {
      const load = metricValue('cpu.util_pct', t, seed);
      return load > 30 ? 2400 : 1500 + 900 * clamp(load / 30, 0, 1);
    }
    case 'mem.used_pct':
      return clamp(38 + 6 * noise(t, seed + 3, [29, 240]), 20, 92);
    case 'mem.available_bytes': {
      const used = metricValue('mem.used_pct', t, seed);
      return (1 - used / 100) * 8 * 1e9;
    }
    case 'disk.used_pct':
      return clamp(38 + (t - BOOT_T) / 86_400_000 / 40 + 0.5 * noise(t, seed + 4, [600]), 10, 97);
    case 'net.rx_bps':
      return clamp(1.2e6 + 1.0e6 * noise(t, seed + 5, [2, 9, 31]), 2e3, 8e6);
    case 'net.tx_bps':
      return clamp(8.4e4 + 6e4 * noise(t, seed + 6, [3, 13, 47]), 1e3, 1e6);
    case 'load.1m': {
      const load = metricValue('cpu.util_pct', t, seed);
      return clamp((load / 100) * 4 + 0.3 * noise(t, seed + 7, [5, 23]), 0.01, 8);
    }
    case 'sys.uptime_s':
      return (t - BOOT_T) / 1000;
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/** Sample a series over [from, to] at a resolution suited to the span. */
export function sampleSeries(key: SeriesKey, from: number, to: number, points = 120, seed = 1): Sample[] {
  const out: Sample[] = [];
  const step = (to - from) / points;
  for (let i = 0; i <= points; i++) {
    const t = from + i * step;
    out.push({ t, v: metricValue(key, t, seed) });
  }
  return out;
}

/** Resolution note for a range, per design decision 4 (state the Rollup tier). */
export function rollupNote(rangeMs: number): string {
  if (rangeMs <= 3_600_000) return '10-second samples';
  if (rangeMs <= 24 * 3_600_000) return '1-minute averages';
  if (rangeMs <= 7 * 24 * 3_600_000) return '10-minute averages';
  return '1-hour averages';
}
