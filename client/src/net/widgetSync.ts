// Keeps the Home/Lock Screen widgets in step with the app: on every telemetry
// snapshot, write the latest metrics + a short sparkline tail + connection state
// to the shared App Group and ask WidgetKit to reload. iOS has no live widgets:
// a widget redraws only when the app asks (cheap while the app is open) or on
// its own timeline, so we reload every few seconds while the app runs and once
// more, unthrottled, the moment the app leaves the screen — the widget then
// shows the very latest reading and ages it honestly from there.
// The widget (targets/widget/RaspberryWidget.swift) reads key "telemetry".
import { AppState } from 'react-native';
import { ExtensionStorage } from '@bacons/apple-targets';
import { useStore } from '../store/useStore';
import type { SeriesKey } from '../types';

const APP_GROUP = 'group.com.abo5.raspberryapp';
const SERIES_KEYS: SeriesKey[] = [
  'cpu.temp_c',
  'cpu.util_pct',
  'cpu.freq_mhz',
  'mem.used_pct',
  'mem.available_bytes',
  'disk.used_pct',
  'net.rx_bps',
  'net.tx_bps',
  'load.1m',
  'sys.uptime_s',
];
const TAIL = 48;             // enough for the largest sparkline
const RELOAD_MIN_MS = 5000; // reloads asked by the app while it's open don't use the widget budget
const FRESH_MS = 20000; // a reading this recent counts as "connected" on the widget

let storage: ExtensionStorage | null = null;
function getStorage(): ExtensionStorage | null {
  if (storage) return storage;
  try {
    storage = new ExtensionStorage(APP_GROUP);
  } catch {
    storage = null; // native module unavailable (tests, Expo Go)
  }
  return storage;
}

// Rolling sparkline tails, keyed by SeriesKey, kept in this module's memory.
const tails: Partial<Record<SeriesKey, [number, number][]>> = {};

let lastPayload = '';
let lastReload = 0;

function push(force = false) {
  const s = useStore.getState();
  const snap = s.snapshot;
  if (!snap) return; // no telemetry yet — leave the last stored contents alone

  for (const key of SERIES_KEYS) {
    const v = snap.values[key];
    if (v == null) continue;
    const t = tails[key] ?? (tails[key] = []);
    t.push([snap.producedAt, v]);
    if (t.length > TAIL) t.shift();
  }

  const agent = s.agents.find((a) => a.id === s.currentAgentId) ?? s.agents[0];
  const rttMs = s.connection.kind === 'connected' ? s.connection.rttMs : 0;

  // Monitoring over SSH names the Pi by its hostname (read over SSH).
  const ssh = s.sshMonitor;
  const viaConnect = !ssh && s.connectMonitorName;
  const payload = JSON.stringify({
    agentName: ssh ? ssh.name ?? ssh.host : viaConnect ? viaConnect : agent?.name ?? 'your Pi',
    agentId: ssh ? `ssh:${ssh.host}` : viaConnect ? `connect:${s.monitorDeviceId ?? viaConnect}` : agent?.id ?? '',
    // The live link can blip (reconnecting, paused for a desktop session) while
    // the numbers are seconds old — judge by the reading's age instead.
    connection: Date.now() - snap.receivedAt < FRESH_MS ? 'connected' : s.connection.kind,
    rttMs,
    producedAt: snap.producedAt,
    receivedAt: snap.receivedAt,
    values: snap.values,
    series: tails,
  });
  if (payload === lastPayload && !force) return;
  lastPayload = payload;

  const store = getStorage();
  if (!store) return;
  try {
    store.set('telemetry', payload);
    const now = Date.now();
    if (force || now - lastReload >= RELOAD_MIN_MS) {
      lastReload = now;
      ExtensionStorage.reloadWidget();
    }
  } catch {}
}

export function startWidgetSync(): void {
  push();
  useStore.subscribe(() => push());
  // Leaving the app: hand the widget the newest reading right now.
  AppState.addEventListener('change', (st) => {
    if (st !== 'active') push(true);
  });
}
