// Monitor over SSH: log in to the Pi with the user's own SSH account, run the
// read-only METRICS_COMMAND every few seconds, and feed the same store surface
// the agent transport uses (connection, snapshot) — so the Monitor screens work
// unchanged. History is kept in memory for the charts.
import { AppState } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PiSsh } from '../../modules/pi-ssh';
import { SshMonitorTarget, useStore } from '../store/useStore';
import { ConnPath, Sample, SeriesKey } from '../types';
import { METRICS_COMMAND, RawReading, parseReading, toValues } from './sshMetrics';

const PASSWORD_KEY = 'pimon.ssh.password';
const POLL_MS = 3000;
const MAX_SAMPLES = 7200; // 6 h at 3 s

const S = () => useStore.getState();

let sessionId: string | null = null;
let pollTimer: ReturnType<typeof setTimeout> | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let backoff = 2000;
let running = false;
let prev: RawReading | null = null;
const history = new Map<SeriesKey, Sample[]>();

export type SshConnectError = 'auth' | 'hostKeyChanged' | 'unreachable' | 'unavailable';

function classify(e: unknown): SshConnectError {
  const msg = String((e as Error)?.message ?? e);
  if (/HOST_KEY_CHANGED/.test(msg)) return 'hostKeyChanged';
  if (/auth|permission|password|allAuthenticationOptionsFailed/i.test(msg)) return 'auth';
  if (/not available|unavailable/i.test(msg)) return 'unavailable';
  return 'unreachable';
}

export const savePassword = (pw: string) => SecureStore.setItemAsync(PASSWORD_KEY, pw);
const readPassword = () => SecureStore.getItemAsync(PASSWORD_KEY);
/** Drop the saved password (used on a fresh install: the Keychain outlives the app). */
export const forgetPassword = () => SecureStore.deleteItemAsync(PASSWORD_KEY).catch(() => {});

function record(at: number, values: Partial<Record<SeriesKey, number>>) {
  (Object.keys(values) as SeriesKey[]).forEach((k) => {
    const v = values[k];
    if (v === undefined) return;
    const list = history.get(k) ?? [];
    list.push({ t: at, v });
    if (list.length > MAX_SAMPLES) list.splice(0, list.length - MAX_SAMPLES);
    history.set(k, list);
  });
}

/** Samples for one series within [from, to] — used by the Monitor charts. */
export function sshSeries(key: SeriesKey, from: number, to: number): Sample[] {
  return (history.get(key) ?? []).filter((s) => s.t >= from && s.t <= to);
}

/** The last hour of one series, averaged into `points` buckets (widget sparklines). */
export function sshSparkline(key: SeriesKey, points: number): Sample[] {
  const to = Date.now();
  const from = to - 3_600_000;
  const all = sshSeries(key, from, to);
  if (all.length <= points) return all;
  const step = (to - from) / points;
  const out: Sample[] = [];
  for (let i = 0; i < points; i++) {
    const a = from + i * step;
    const bucket = all.filter((s) => s.t >= a && s.t < a + step);
    if (bucket.length) out.push({ t: a + step / 2, v: bucket.reduce((x, s) => x + s.v, 0) / bucket.length });
  }
  return out;
}

/** Forget the in-memory history (the monitored Pi changed). */
export function clearHistory(): void {
  history.clear();
  prev = null;
  clearLiveCache();
}

/** Turn one METRICS_COMMAND output into a snapshot + history samples. Shared by
 * both live sources: this SSH session and Connect's remote shell. */
export function applyReading(out: string, startedAt: number, path: ConnPath): string | null {
  const now = Date.now();
  const reading = parseReading(out, now);
  const values = toValues(reading, prev);
  prev = reading;
  record(now, values);
  S().set({
    snapshot: { producedAt: now, receivedAt: now, values },
    connection: { kind: 'connected', path, rttMs: now - startedAt, verified: true },
  });
  return reading.hostname;
}

// Another way to run a command when there's no SSH session (Connect's remote
// shell registers itself here), so Live Commands etc. work over either.
let execFallback: ((command: string) => Promise<string>) | null = null;
export function setExecFallback(fn: ((command: string) => Promise<string>) | null): void {
  execFallback = fn;
}

/** Run a command on the Pi over the live monitoring session (stdout + stderr
 * merged, with its exit code). null when not connected. */
export async function sshExec(command: string): Promise<{ output: string; exitCode: number } | null> {
  const run = sessionId ? (c: string) => PiSsh.exec(sessionId!, c) : execFallback;
  if (!run) return null;
  try {
    const out = await run(`(${command}) 2>&1; printf '\n@@EXIT=%s' $?`);
    const m = /\n?@@EXIT=(\d+)\s*$/.exec(out);
    return { output: m ? out.slice(0, m.index) : out, exitCode: m ? Number(m[1]) : 0 };
  } catch {
    return null;
  }
}

/** One-off connect used by the setup form: verifies the login and returns the
 * host key and hostname to save. Leaves no session open. */
export async function testSshLogin(
  host: string, port: number, username: string, password: string,
): Promise<{ ok: true; hostKey: string; name: string | null } | { ok: false; error: SshConnectError }> {
  try {
    const { id, hostKey } = await PiSsh.connect(host, port, username, password, null);
    let name: string | null = null;
    try { name = (await PiSsh.exec(id, 'hostname')).trim() || null; } catch {}
    await PiSsh.disconnect(id);
    return { ok: true, hostKey, name };
  } catch (e) {
    return { ok: false, error: classify(e) };
  }
}

async function poll() {
  pollTimer = null;
  if (!running || !sessionId) return;
  const started = Date.now();
  try {
    const out = await PiSsh.exec(sessionId, METRICS_COMMAND);
    const first = prev === null;
    const hostname = applyReading(out, started, 'direct');
    const target = S().sshMonitor;
    if (target && hostname && hostname !== target.name) {
      S().set({ sshMonitor: { ...target, name: hostname } });
    }
    backoff = 2000;
    // CPU % and network speed need two readings — take the 2nd one quickly.
    pollTimer = setTimeout(poll, first ? 800 : POLL_MS);
  } catch {
    // Lost the session (Wi-Fi drop, Pi rebooted…) → reconnect with backoff.
    dropSession();
    scheduleRetry();
  }
}

function dropSession() {
  if (sessionId) PiSsh.disconnect(sessionId).catch(() => {});
  sessionId = null;
  prev = null;
}

function scheduleRetry() {
  if (!running || retryTimer) return;
  S().set({ connection: { kind: 'reconnecting', attempt: 1, nextTryInS: Math.round(backoff / 1000) } });
  retryTimer = setTimeout(() => {
    retryTimer = null;
    open();
  }, backoff);
  backoff = Math.min(Math.round(backoff * 1.6), 30000);
}

async function open() {
  const target: SshMonitorTarget | null = S().sshMonitor;
  if (!running || !target) return;
  const password = await readPassword();
  if (!password) {
    S().set({ connection: { kind: 'offline', lastSeen: Date.now() } });
    return;
  }
  S().set({ connection: { kind: 'connecting', milestone: 0 } });
  try {
    const { id, hostKey } = await PiSsh.connect(target.host, target.port, target.username, password, target.hostKey);
    if (!running) { PiSsh.disconnect(id).catch(() => {}); return; }
    sessionId = id;
    if (!target.hostKey && hostKey) S().set({ sshMonitor: { ...target, hostKey } });
    S().set({ connection: { kind: 'connecting', milestone: 3 } });
    poll();
  } catch (e) {
    const kind = classify(e);
    if (kind === 'auth' || kind === 'hostKeyChanged') {
      // Retrying won't help — say so and wait for the user to fix the login.
      S().set({ connection: { kind: 'offline', lastSeen: Date.now() } });
      S().addEvent('WARN', kind === 'auth' ? 'SSH login was rejected — check the username and password' : 'The Pi’s SSH host key changed — re-add it in Monitor');
      return;
    }
    scheduleRetry();
  }
}

// Pause while the app is in the background; resume when it's back.
let wanted = false;
let appStateHooked = false;
function hookAppState() {
  if (appStateHooked) return;
  appStateHooked = true;
  AppState.addEventListener('change', (st) => {
    if (!wanted) return;
    if (st === 'active') resume();
    else if (st === 'background') pause();
  });
}

function resume() {
  if (running) return;
  running = true;
  backoff = 2000;
  open();
}

function pause() {
  running = false;
  if (pollTimer) clearTimeout(pollTimer);
  if (retryTimer) clearTimeout(retryTimer);
  pollTimer = null;
  retryTimer = null;
  dropSession();
}

export function startSshMonitor(): void {
  wanted = true;
  hookAppState();
  if (running) return;
  running = true;
  backoff = 2000;
  open();
}

export function stopSshMonitor(): void {
  wanted = false;
  pause();
}

/** Forget the SSH target, its password and the in-memory history. */
export async function removeSshMonitor(): Promise<void> {
  stopSshMonitor();
  history.clear();
  clearLiveCache();
  await SecureStore.deleteItemAsync(PASSWORD_KEY).catch(() => {});
  S().set({ sshMonitor: null, snapshot: null, connection: { kind: 'unknown' } });
}

// ---- Instant Monitor on launch ----------------------------------------------
// The last reading and the recent chart history are kept on disk, so after the
// app is closed and reopened Monitor shows numbers and charts immediately while
// the live source (SSH / Connect) reconnects in the background.

const CACHE_KEY = 'pimon-live-cache-v1';
const CACHE_SPAN_MS = 30 * 60_000; // keep the last 30 min of each chart
const CACHE_MAX_AGE_MS = 6 * 3_600_000; // older than this isn't "the last reading" any more

type LiveCache = { savedAt: number; snapshot: unknown; history: Record<string, [number, number][]> };

/** Put the saved reading + history back (called while the app hydrates). */
export async function loadLiveCache(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw) as LiveCache;
    if (Date.now() - data.savedAt > CACHE_MAX_AGE_MS) return;
    Object.entries(data.history ?? {}).forEach(([k, list]) => {
      history.set(k as SeriesKey, list.map(([t, v]) => ({ t, v })));
    });
    if (data.snapshot && !S().snapshot) S().set({ snapshot: data.snapshot as never });
  } catch {}
}

async function saveLiveCache(): Promise<void> {
  const snapshot = S().snapshot;
  if (!snapshot) return;
  const from = Date.now() - CACHE_SPAN_MS;
  const out: LiveCache['history'] = {};
  history.forEach((list, k) => {
    const recent = list.filter((s) => s.t >= from).map((s) => [s.t, s.v] as [number, number]);
    if (recent.length) out[k] = recent;
  });
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: Date.now(), snapshot, history: out }));
  } catch {}
}

/** Forget the saved reading (signed out / monitoring removed / another Pi). */
export function clearLiveCache(): void {
  AsyncStorage.removeItem(CACHE_KEY).catch(() => {});
}

let cacheSaverStarted = false;
export function startLiveCacheSaver(): void {
  if (cacheSaverStarted) return;
  cacheSaverStarted = true;
  setInterval(saveLiveCache, 20_000);
  AppState.addEventListener('change', (st) => {
    if (st !== 'active') saveLiveCache();
  });
}
