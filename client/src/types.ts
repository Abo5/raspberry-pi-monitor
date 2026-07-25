// Shared vocabulary per docs/00-GLOSSARY.md and docs/06-DATA-MODEL.md.

export type SeriesKey =
  | 'cpu.temp_c'
  | 'cpu.util_pct'
  | 'cpu.freq_mhz'
  | 'mem.used_pct'
  | 'mem.available_bytes'
  | 'disk.used_pct'
  | 'net.rx_bps'
  | 'net.tx_bps'
  | 'load.1m'
  | 'sys.uptime_s';

export interface SeriesMeta {
  key: SeriesKey;
  label: string; // eyebrow, e.g. "SOC TEMP"
  title: string; // full, e.g. "SoC temperature"
  unit: string;
  decimals: number;
  hardThresholds?: { soft: number; hard: number }; // temperature only
}

export interface Sample {
  t: number; // epoch ms
  v: number;
}

/** One telemetry tick from the Agent. producedAt/receivedAt are distinct per OD (design decision 9). */
export interface Snapshot {
  producedAt: number;
  receivedAt: number;
  values: Partial<Record<SeriesKey, number>>;
}

export type TimeRange = '15m' | '1h' | '6h' | '24h' | '7d' | '30d';

export const RANGE_MS: Record<TimeRange, number> = {
  '15m': 15 * 60_000,
  '1h': 3_600_000,
  '6h': 6 * 3_600_000,
  '24h': 24 * 3_600_000,
  '7d': 7 * 24 * 3_600_000,
  '30d': 30 * 24 * 3_600_000,
};

export type ConnPath = 'direct' | 'relayed';

export type ConnectionState =
  | { kind: 'unknown' }
  | { kind: 'connecting'; milestone: 0 | 1 | 2 | 3 } // transport up → handshake sent → handshake complete → first Channel open
  | { kind: 'connected'; path: ConnPath; rttMs: number; verified: boolean }
  | { kind: 'reconnecting'; attempt: number; nextTryInS: number }
  | { kind: 'offline'; lastSeen: number };

export interface Agent {
  id: string;
  name: string;
  hostname: string;
  model: string; // "Raspberry Pi 5 · 8 GB"
  os: string;
  agentVersion: string;
  fingerprintHex: string; // 32 hex chars
  fingerprintWords: string[]; // 6 words
  pairedAt: number;
  verifiedAt: number | null;
}

export type Severity = 'info' | 'warning' | 'critical';

export interface AlertRule {
  id: string;
  seriesKey: SeriesKey;
  op: 'above' | 'below';
  threshold: number;
  dwellS: number;
  severity: Severity;
  enabled: boolean;
  notify: boolean;
}

export interface Alert {
  id: string;
  ruleId: string;
  agentId: string;
  seriesKey: SeriesKey;
  severity: Severity;
  title: string; // "SoC temp above 80 °C"
  firedAt: number;
  resolvedAt: number | null;
  acknowledgedAt: number | null;
  snoozedUntil: number | null;
  peak: { v: number; t: number };
}

/** Allow-listed operation with the metadata design decision 5 requires. */
export interface AgentAction {
  id: string;
  category: string; // Agent-supplied group
  name: string;
  command: string; // the literal command, always shown
  expectedDurationS: number;
  destructive: boolean;
  dropsTunnel: boolean;
  confirmText?: string; // extra consequence line
  lastRun?: { at: number; exitCode: number; durationS: number };
}

export interface TrustedDevice {
  id: string;
  name: string;
  isThisDevice: boolean;
  pairedAt: number;
  lastSeen: number;
}

export interface LogEvent {
  t: number;
  level: 'INFO' | 'WARN' | 'ERROR';
  message: string;
}
