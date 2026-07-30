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
}

const S = () => useStore.getState();

let telemetryWs: WebSocket | null = null;
let rttTimer: ReturnType<typeof setInterval> | null = null;

function httpBase(ep: Endpoint) {
  return `http://${ep.ip}:${ep.port}`;
}
function wsBase(ep: Endpoint) {
  return `ws://${ep.ip}:${ep.port}`;
}

/** Fetch the Agent's identity facts (also validates the token). */
export async function fetchAgentFacts(ep: Endpoint): Promise<{
  name: string;
  hostname: string;
  model: string;
  os: string;
  agent_version: string;
} | null> {
  try {
    const res = await fetch(`${httpBase(ep)}/agent`, {
      headers: { Authorization: `Bearer ${ep.token}` },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/** Open a live connection: milestones → telemetry stream → store snapshots. */
export async function connectLocal(ep: Endpoint): Promise<void> {
  disconnectLocal();
  S().set({ connection: { kind: 'connecting', milestone: 0 } });
  S().addEvent('INFO', `transport up (${ep.ip}:${ep.port})`);

  const t0 = Date.now();
  const facts = await fetchAgentFacts(ep);
  if (!facts) {
    S().set({ connection: { kind: 'offline', lastSeen: Date.now() } });
    S().addEvent('ERROR', 'could not reach the Agent (check ip/port/token)');
    return;
  }
  S().set({ connection: { kind: 'connecting', milestone: 2 } });
  S().addEvent('INFO', 'handshake complete');

  const ws = new WebSocket(`${wsBase(ep)}/telemetry?token=${encodeURIComponent(ep.token)}`);
  telemetryWs = ws;

  ws.onopen = () => {
    const rtt = Date.now() - t0;
    S().set({
      connection: { kind: 'connected', path: 'direct', rttMs: rtt, verified: true },
      rttHistory: [...S().rttHistory, { t: Date.now(), v: rtt }].slice(-150),
    });
    S().addEvent('INFO', 'telemetry channel open');
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

  ws.onerror = () => S().addEvent('WARN', 'telemetry socket error');
  ws.onclose = () => {
    if (S().connection.kind === 'connected') {
      S().set({ connection: { kind: 'offline', lastSeen: Date.now() } });
      S().addEvent('WARN', 'telemetry socket closed');
    }
    stopRttPing();
  };
}

export function disconnectLocal(): void {
  stopRttPing();
  if (telemetryWs) {
    telemetryWs.onclose = null;
    telemetryWs.close();
    telemetryWs = null;
  }
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
