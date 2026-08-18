// Number formatting rules per docs/07-UX-SPEC.md §18: always a unit; temperature
// 1 dp; percentages 1 dp under 10, 0 dp above; bytes auto-scaled to 3 sig figs;
// durations 50 s / 4 min / 14 d; relative times up to 7 days, absolute after.

export function fmtPct(v: number): string {
  return v < 10 ? v.toFixed(1) : Math.round(v).toString();
}

export function fmtTemp(v: number): string {
  return v.toFixed(1);
}

export function fmtBytes(v: number): { value: string; unit: string } {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  let x = v;
  while (x >= 1000 && i < units.length - 1) {
    x /= 1000;
    i++;
  }
  const value = x >= 100 ? x.toFixed(0) : x >= 10 ? x.toFixed(1) : x.toFixed(2);
  return { value, unit: units[i] };
}

export function fmtBps(v: number): { value: string; unit: string } {
  const b = fmtBytes(v);
  return { value: b.value, unit: `${b.unit}/s` };
}

export function fmtDuration(s: number): string {
  if (s < 90) return `${Math.round(s)} s`;
  if (s < 90 * 60) return `${Math.round(s / 60)} min`;
  if (s < 48 * 3600) return `${Math.round(s / 3600)} h`;
  return `${Math.round(s / 86400)} d`;
}

export function fmtClock(t: number): string {
  const d = new Date(t);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

export function fmtRelative(t: number, now: number = Date.now()): string {
  const dt = Math.max(0, now - t);
  if (dt < 60_000) return 'now';
  if (dt < 3_600_000) return `${Math.floor(dt / 60_000)}m`;
  if (dt < 86_400_000) return `${Math.floor(dt / 3_600_000)}h`;
  if (dt < 7 * 86_400_000) return `${Math.floor(dt / 86_400_000)}d`;
  const d = new Date(t);
  return `${d.getDate()} ${d.toLocaleString('en', { month: 'short' })}`;
}

export function fmtValue(key: string, v: number): { value: string; unit: string } {
  switch (key) {
    case 'cpu.temp_c':
      return { value: fmtTemp(v), unit: '°C' };
    case 'cpu.util_pct':
    case 'mem.used_pct':
    case 'disk.used_pct':
      return { value: fmtPct(v), unit: '%' };
    case 'cpu.freq_mhz':
      return { value: Math.round(v).toString(), unit: 'MHz' };
    case 'mem.available_bytes':
      return fmtBytes(v);
    case 'net.rx_bps':
    case 'net.tx_bps':
      return fmtBps(v);
    case 'load.1m':
      return { value: v.toFixed(2), unit: '' };
    case 'sys.uptime_s':
      return { value: fmtDuration(v), unit: '' };
    default:
      return { value: v.toFixed(1), unit: '' };
  }
}
