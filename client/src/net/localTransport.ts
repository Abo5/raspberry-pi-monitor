// Real transport (Track A / LAN MVP). Talks to the Rust Agent's local HTTP/WS
// dev API (planning/07-PROTOCOL-API.md §1) and drives the same store surface the
// simulation drove, so the screens don't change.
//
// The connection state mirrors the four handshake milestones the ConnectionBanner
// renders, driven by real network events (not a timer).
import { useStore } from '../store/useStore';

export interface Endpoint {
  ip: string;
  port: string;
  token: string;
  hostname?: string; // for an mDNS (.local) fallback if the IP changes
}

const S = () => useStore.getState();

let telemetryWs: WebSocket | null = null;
let rttTimer: ReturnType<typeof setInterval> | null = null;

// Auto-reconnect state: while the user wants this Pi connected, we keep retrying
// (agent restart, brief Wi-Fi drop) with backoff — the app recovers on its own.
let activeEp: Endpoint | null = null;
let wantConnected = false;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let backoff = 2000;

function closeSocket() {
  stopRttPing();
  if (telemetryWs) {
    telemetryWs.onclose = null;
    telemetryWs.onerror = null;
    try { telemetryWs.close(); } catch { /* noop */ }
    telemetryWs = null;
  }
}

/** After an IP change, rewrite the stored endpoint so every channel uses the
 * reachable host (matched by token+port, which are stable). */
function healEndpointIp(ep: Endpoint, newIp: string) {
  const eps = S().endpoints;
  const id = Object.keys(eps).find((k) => eps[k].token === ep.token && eps[k].port === ep.port);
  if (id && eps[id].ip !== newIp) {
    S().set({ endpoints: { ...eps, [id]: { ...eps[id], ip: newIp } } });
  }
}

function scheduleReconnect() {
  if (!wantConnected || !activeEp || reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    if (wantConnected && activeEp) connectLocal(activeEp, true);
  }, backoff);
  backoff = Math.min(Math.round(backoff * 1.6), 15000);
}

function httpBase(ep: Endpoint) {
  return `http://${ep.ip}:${ep.port}`;
}
function wsBase(ep: Endpoint) {
  return `ws://${ep.ip}:${ep.port}`;
}

/** Fetch the Agent's identity facts (also validates the token). Fails fast on an
 * unreachable Pi (7s timeout) so the UI never hangs. Returns 'unauthorized' when
 * the Pi answered but rejected the token, so the user gets the right message. */
export type FactsResult =
  | { name: string; hostname: string; model: string; os: string; agent_version: string }
  | 'unauthorized'
  | null;

export async function fetchAgentFacts(ep: Endpoint): Promise<FactsResult> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 7000);
  try {
    const res = await fetch(`${httpBase(ep)}/agent`, {
      headers: { Authorization: `Bearer ${ep.token}` },
      signal: ctrl.signal,
    });
    if (res.status === 401 || res.status === 403) return 'unauthorized';
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null; // timeout / network unreachable
  } finally {
    clearTimeout(t);
  }
}

/** Open a live connection: milestones → telemetry stream → store snapshots.
 * `isReconnect` retries keep `wantConnected` intact so the loop survives. */
export async function connectLocal(ep: Endpoint, isReconnect = false): Promise<void> {
  closeSocket();
  wantConnected = true;
  activeEp = ep;
  if (!isReconnect) backoff = 2000;
  S().set({ connection: { kind: 'connecting', milestone: 0 } });
  if (!isReconnect) S().addEvent('INFO', `transport up (${ep.ip}:${ep.port})`);

  const t0 = Date.now();
  let facts = await fetchAgentFacts(ep);
  // If the saved IP is unreachable (e.g. DHCP gave the Pi a new address after a
  // reboot), fall back to its mDNS name and heal the stored endpoint.
  if (facts === null && ep.hostname) {
    const altIp = `${ep.hostname}.local`;
    if (altIp !== ep.ip) {
      const alt = await fetchAgentFacts({ ...ep, ip: altIp });
      if (alt && alt !== 'unauthorized') {
        facts = alt;
        ep = { ...ep, ip: altIp };
        activeEp = ep;
        healEndpointIp(ep, altIp);
        S().addEvent('INFO', `IP changed — reached the Pi at ${altIp}`);
      }
    }
  }
  if (facts === 'unauthorized') {
    // A rejected key won't fix itself — stop retrying and tell the user.
    wantConnected = false;
    S().set({ connection: { kind: 'offline', lastSeen: Date.now() } });
    S().addEvent('ERROR', 'the Pi rejected the key');
    return;
  }
  if (!facts) {
    S().set({ connection: { kind: 'offline', lastSeen: Date.now() } });
    S().addEvent('ERROR', 'could not reach the Pi');
    scheduleReconnect(); // keep trying — the Pi may just be rebooting
    return;
  }
  S().set({ connection: { kind: 'connecting', milestone: 2 } });
  S().addEvent('INFO', 'handshake complete');

  const ws = new WebSocket(`${wsBase(ep)}/telemetry?token=${encodeURIComponent(ep.token)}`);
  telemetryWs = ws;

  // If the telemetry socket never opens (e.g. the Pi drops off between the facts
  // fetch and the upgrade), fail to 'offline' instead of hanging on 'connecting'.
  let opened = false;
  const openTimer = setTimeout(() => {
    if (!opened && S().connection.kind !== 'connected') {
      try { ws.close(); } catch { /* noop */ }
      if (telemetryWs === ws) telemetryWs = null;
      S().set({ connection: { kind: 'offline', lastSeen: Date.now() } });
      S().addEvent('ERROR', 'could not open the live channel');
    }
  }, 7000);

  ws.onopen = () => {
    opened = true;
    clearTimeout(openTimer);
    backoff = 2000; // recovered — reset backoff
    const rtt = Date.now() - t0;
    S().set({
      connection: { kind: 'connected', path: 'direct', rttMs: rtt, verified: true },
      rttHistory: [...S().rttHistory, { t: Date.now(), v: rtt }].slice(-150),
    });
    if (!isReconnect) S().addEvent('INFO', 'telemetry channel open');
    startRttPing(ep);
  };

  ws.onmessage = (e) => {
    try {
      const snap = JSON.parse(e.data as string);
      S().set({
        snapshot: {
          producedAt: snap.producedAt,
          receivedAt: Date.now(),
          values: snap.values ?? {},
        },
      });
    } catch {
      // ignore malformed frame
    }
  };

  ws.onerror = () => {};
  ws.onclose = () => {
    clearTimeout(openTimer);
    stopRttPing();
    if (telemetryWs === ws) telemetryWs = null;
    if (wantConnected) {
      // Unexpected drop (agent restart / Wi-Fi blip) → show offline and keep trying.
      if (S().connection.kind === 'connected') S().addEvent('WARN', 'reconnecting…');
      S().set({ connection: { kind: 'offline', lastSeen: Date.now() } });
      scheduleReconnect();
    }
  };
}

export function disconnectLocal(): void {
  wantConnected = false;
  activeEp = null;
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  closeSocket();
}

/** Poll /health to keep an RTT sparkline honest while connected. */
function startRttPing(ep: Endpoint) {
  stopRttPing();
  rttTimer = setInterval(async () => {
    if (S().connection.kind !== 'connected') return;
    const t = Date.now();
    try {
      const res = await fetch(`${httpBase(ep)}/health`, { headers: { Authorization: `Bearer ${ep.token}` } });
      if (!res.ok) return;
      const rtt = Date.now() - t;
      const c = S().connection;
      if (c.kind === 'connected') {
        S().set({
          connection: { ...c, rttMs: rtt },
          rttHistory: [...S().rttHistory, { t: Date.now(), v: rtt }].slice(-150),
        });
      }
    } catch {
      // transient; the WS onclose handles real drops
    }
  }, 3000);
}
function stopRttPing() {
  if (rttTimer) clearInterval(rttTimer);
  rttTimer = null;
}

/** Open an interactive shell over WS /shell. Returns a small handle. */
export function openLocalShell(
  ep: Endpoint,
  handlers: { onData: (text: string) => void; onClose: () => void },
): { send: (text: string) => void; resize: (cols: number, rows: number) => void; close: () => void } {
  const ws = new WebSocket(`${wsBase(ep)}/shell?token=${encodeURIComponent(ep.token)}`);
  ws.binaryType = 'arraybuffer';

  ws.onmessage = (e) => {
    const data = e.data;
    if (typeof data === 'string') {
      handlers.onData(data);
    } else {
      // ArrayBuffer of PTY bytes → decode as UTF-8
      try {
        const text = new TextDecoder().decode(new Uint8Array(data as ArrayBuffer));
        handlers.onData(text);
      } catch {
        // ignore
      }
    }
  };
  ws.onclose = handlers.onClose;

  return {
    send: (text: string) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(text);
    },
    resize: (cols: number, rows: number) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ resize: { cols, rows } }));
    },
    close: () => ws.close(),
  };
}

function authGet(ep: Endpoint, path: string) {
  return fetch(`${httpBase(ep)}${path}`, { headers: { Authorization: `Bearer ${ep.token}` } });
}
function authJson(ep: Endpoint, method: string, path: string, body: unknown) {
  return fetch(`${httpBase(ep)}${path}`, {
    method,
    headers: { Authorization: `Bearer ${ep.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/** Allow-listed actions from the Agent config. */
export async function fetchActions(ep: Endpoint): Promise<any[]> {
  try {
    const r = await authGet(ep, '/actions');
    return r.ok ? await r.json() : [];
  } catch {
    return [];
  }
}

/** Run one allow-listed action; returns the Agent's result. */
export async function runActionRemote(ep: Endpoint, id: string): Promise<any | null> {
  try {
    const r = await authJson(ep, 'POST', `/actions/${encodeURIComponent(id)}/run`, {});
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
}

export async function fetchRules(ep: Endpoint): Promise<any[]> {
  try {
    const r = await authGet(ep, '/rules');
    return r.ok ? await r.json() : [];
  } catch {
    return [];
  }
}
export async function putRule(ep: Endpoint, rule: unknown): Promise<boolean> {
  try {
    const r = await authJson(ep, 'PUT', '/rules', rule);
    return r.ok;
  } catch {
    return false;
  }
}
export async function deleteRuleRemote(ep: Endpoint, id: string): Promise<boolean> {
  try {
    const r = await fetch(`${httpBase(ep)}/rules/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${ep.token}` },
    });
    return r.ok;
  } catch {
    return false;
  }
}

export async function fetchAlerts(ep: Endpoint): Promise<any[]> {
  try {
    const r = await authGet(ep, '/alerts');
    return r.ok ? await r.json() : [];
  } catch {
    return [];
  }
}

/** Backtest a rule over the given range; returns { count, spans }. */
export async function backtestRemote(
  ep: Endpoint,
  body: { key: string; op: string; threshold: number; dwellS: number; rangeMs: number },
): Promise<{ count: number; spans: { from: number; to: number }[] } | null> {
  try {
    const r = await authJson(ep, 'POST', '/backtest', body);
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
}

/** Fetch history for one series (charts). */
export async function fetchSeries(
  ep: Endpoint,
  key: string,
  fromMs: number,
  toMs: number,
): Promise<{ t: number; v: number }[]> {
  try {
    const url = `${httpBase(ep)}/series?key=${encodeURIComponent(key)}&from=${fromMs}&to=${toMs}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${ep.token}` } });
    if (!res.ok) return [];
    const body = await res.json();
    return body.samples ?? [];
  } catch {
    return [];
  }
}
