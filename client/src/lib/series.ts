// Series metadata catalog — labels, units, decimals and hard thresholds for
// every telemetry series the app knows. Purely descriptive; values always come
// from the Agent.
import { SeriesKey, SeriesMeta } from '../types';

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

/** Resolution note for a range, per design decision 4 (state the Rollup tier). */
export function rollupNote(rangeMs: number): string {
  if (rangeMs <= 3_600_000) return '10-second samples';
  if (rangeMs <= 24 * 3_600_000) return '1-minute averages';
  if (rangeMs <= 7 * 24 * 3_600_000) return '10-minute averages';
  return '1-hour averages';
}
