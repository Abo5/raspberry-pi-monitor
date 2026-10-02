// Reading the Pi's metrics over SSH: one read-only command prints the raw
// sources (all from /proc, /sys and df — standard on any Linux), and a pure
// parser turns two consecutive readings into the Monitor's values. CPU use and
// network speed (bytes/s, like the agent) are rates, so they need the previous
// reading.
import { SeriesKey } from '../types';

const SEP = '@@PIMON@@';

/** Prints each source followed by a separator line. Never fails (ends in `true`). */
export const METRICS_COMMAND = [
  'head -1 /proc/stat',
  'cat /sys/class/thermal/thermal_zone0/temp',
  'grep -E "^(MemTotal|MemAvailable):" /proc/meminfo',
  'df -Pk / | tail -1',
  'cat /proc/net/dev',
  'cat /proc/loadavg',
  'cat /proc/uptime',
  'cat /sys/devices/system/cpu/cpu0/cpufreq/scaling_cur_freq',
  'hostname',
]
  .map((c) => `${c} 2>/dev/null; echo ${SEP}`)
  .join('; ')
  .concat('; true');

export interface RawReading {
  at: number; // ms
  cpuTotal: number;
  cpuIdle: number;
  rxBytes: number;
  txBytes: number;
  values: Partial<Record<SeriesKey, number>>;
  hostname: string | null;
}

// Number('') is 0 — a missing source must stay "no value", not zero.
const num = (s: string | undefined) => {
  if (s === undefined || s.trim() === '') return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
};

/** Parse one command output into absolute counters + instant values. */
export function parseReading(out: string, at: number): RawReading {
  const [stat, temp, mem, df, net, load, uptime, freq, host] = out.split(SEP).map((p) => p.trim());
  const values: Partial<Record<SeriesKey, number>> = {};

  // cpu  user nice system idle iowait irq softirq steal …
  const cpu = (stat ?? '').split(/\s+/).slice(1).map(Number).filter((n) => Number.isFinite(n));
  const cpuTotal = cpu.slice(0, 8).reduce((a, b) => a + b, 0);
  const cpuIdle = (cpu[3] ?? 0) + (cpu[4] ?? 0);

  const milli = num(temp);
  if (milli !== undefined) values['cpu.temp_c'] = milli > 1000 ? milli / 1000 : milli;

  const memTotal = num(/MemTotal:\s+(\d+)/.exec(mem ?? '')?.[1]);
  const memAvail = num(/MemAvailable:\s+(\d+)/.exec(mem ?? '')?.[1]);
  if (memTotal && memAvail !== undefined) {
    values['mem.used_pct'] = ((memTotal - memAvail) / memTotal) * 100;
    values['mem.available_bytes'] = memAvail * 1024;
  }

  // Filesystem 1024-blocks Used Available Capacity Mounted-on
  const d = (df ?? '').split(/\s+/);
  const dUsed = num(d[2]);
  const dAvail = num(d[3]);
  if (dUsed !== undefined && dAvail !== undefined && dUsed + dAvail > 0) {
    values['disk.used_pct'] = (dUsed / (dUsed + dAvail)) * 100;
  }

  // Sum every interface except loopback.
  let rxBytes = 0;
  let txBytes = 0;
  (net ?? '').split('\n').forEach((line) => {
    const m = /^\s*([^:\s]+):\s*(.*)$/.exec(line);
    if (!m || m[1] === 'lo') return;
    const f = m[2].trim().split(/\s+/).map(Number);
    if (Number.isFinite(f[0])) rxBytes += f[0];
    if (Number.isFinite(f[8])) txBytes += f[8];
  });

  const l1 = num((load ?? '').split(/\s+/)[0]);
  if (l1 !== undefined) values['load.1m'] = l1;
  const up = num((uptime ?? '').split(/\s+/)[0]);
  if (up !== undefined) values['sys.uptime_s'] = up;
  const khz = num(freq);
  if (khz !== undefined) values['cpu.freq_mhz'] = khz / 1000;

  return { at, cpuTotal, cpuIdle, rxBytes, txBytes, values, hostname: host || null };
}

/** Combine a reading with the previous one: adds CPU % and network bytes/s. */
export function toValues(cur: RawReading, prev: RawReading | null): Partial<Record<SeriesKey, number>> {
  const v = { ...cur.values };
  if (prev) {
    const dt = (cur.at - prev.at) / 1000;
    const dTotal = cur.cpuTotal - prev.cpuTotal;
    const dIdle = cur.cpuIdle - prev.cpuIdle;
    if (dTotal > 0) v['cpu.util_pct'] = Math.min(100, Math.max(0, (1 - dIdle / dTotal) * 100));
    if (dt > 0) {
      // Counters reset on reboot / interface change → skip negative deltas.
      const rx = cur.rxBytes - prev.rxBytes;
      const tx = cur.txBytes - prev.txBytes;
      if (rx >= 0) v['net.rx_bps'] = rx / dt;
      if (tx >= 0) v['net.tx_bps'] = tx / dt;
    }
  }
  return v;
}
