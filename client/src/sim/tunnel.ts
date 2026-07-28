// Simulated Tunnel lifecycle. Stands in for the Rendezvous + Noise handshake +
// WebRTC/WebSocket transport (docs/03-ARCHITECTURE, 05-PROTOCOL). The store's
// ConnectionState mirrors the four real handshake milestones so the
// ConnectionBanner rail is driven by events, never a timer (P-D2).
import { useStore } from '../store/useStore';
import { Alert, AlertRule, SeriesKey, Snapshot } from '../types';
import { metricValue, SERIES } from './metrics';
import { ruleTransition } from './rules';
import { fmtValue } from '../lib/format';

let snapTimer: ReturnType<typeof setInterval> | null = null;
let rttTimer: ReturnType<typeof setInterval> | null = null;
let overSince: Partial<Record<string, number>> = {};

const S = () => useStore.getState();

export function startTunnel() {
  stopTunnel();
  const stepMs = 260;
  S().set({ connection: { kind: 'connecting', milestone: 0 } });
  S().addEvent('INFO', 'transport up');
  const steps: (0 | 1 | 2 | 3)[] = [1, 2, 3];
  steps.forEach((m, i) => {
    setTimeout(() => {
      if (S().connection.kind !== 'connecting') return;
      S().set({ connection: { kind: 'connecting', milestone: m } });
      if (m === 1) S().addEvent('INFO', 'handshake sent');
      if (m === 2) S().addEvent('INFO', 'handshake complete');
      if (m === 3) {
        S().addEvent('INFO', 'channel control open');
        establish();
      }
    }, stepMs * (i + 1));
  });
}

function establish() {
  const verified = S().agents.find((a) => a.id === S().currentAgentId)?.verifiedAt != null;
  S().set({ connection: { kind: 'connected', path: 'direct', rttMs: 34, verified } });
  tick(); // first Snapshot immediately
  const interval = S().settings.telemetryIntervalS * 1000;
  snapTimer = setInterval(tick, interval);
  rttTimer = setInterval(() => {
    const c = S().connection;
    if (c.kind !== 'connected') return;
    const rtt = Math.max(18, Math.round(34 + 14 * (Math.random() - 0.5) * 2));
    S().set({
      connection: { ...c, rttMs: rtt },
      rttHistory: [...S().rttHistory, { t: Date.now(), v: rtt }].slice(-150),
    });
  }, 2000);
}

function tick() {
  const now = Date.now();
  const values: Snapshot['values'] = {};
  (Object.keys(SERIES) as SeriesKey[]).forEach((k) => {
    values[k] = metricValue(k, now);
  });
  S().set({ snapshot: { producedAt: now - 40, receivedAt: now, values } });
  evaluateRules(values, now);
}

function evaluateRules(values: Snapshot['values'], now: number) {
  const { rules, alerts, currentAgentId } = S();
  let next = alerts;
  let changed = false;
  for (const rule of rules) {
    if (!rule.enabled) continue;
    const v = values[rule.seriesKey];
    if (v == null) continue;
    const open = next.find((a) => a.ruleId === rule.id && a.resolvedAt == null);
    const decision = ruleTransition(rule, v, now, overSince[rule.id] ?? null, open);
    if (decision.overSince == null) delete overSince[rule.id];
    else overSince[rule.id] = decision.overSince;

    if (decision.kind === 'fire') {
      next = [makeAlert(rule, v, now, currentAgentId ?? ''), ...next];
      changed = true;
      S().addEvent('WARN', `alert fired: ${alertTitle(rule)}`);
    } else if (decision.kind === 'update-peak' && open) {
      next = next.map((a) => (a.id === open.id ? { ...a, peak: { v, t: now } } : a));
      changed = true;
    } else if (decision.kind === 'resolve' && open) {
      next = next.map((a) => (a.id === open.id ? { ...a, resolvedAt: now } : a));
      changed = true;
      S().addEvent('INFO', `alert resolved: ${alertTitle(rule)}`);
    }
  }
  if (changed) S().set({ alerts: next });
}

export function alertTitle(rule: AlertRule): string {
  const meta = SERIES[rule.seriesKey];
  const f = fmtValue(rule.seriesKey, rule.threshold);
  return `${meta.title} ${rule.op} ${f.value}${f.unit ? ' ' + f.unit : ''}`;
}

function makeAlert(rule: AlertRule, v: number, now: number, agentId: string): Alert {
  return {
    id: `al-${now}-${rule.id}`,
    ruleId: rule.id,
    agentId,
    seriesKey: rule.seriesKey,
    severity: rule.severity,
    title: alertTitle(rule),
    firedAt: now,
    resolvedAt: null,
    acknowledgedAt: null,
    snoozedUntil: null,
    peak: { v, t: now },
  };
}

export function stopTunnel() {
  if (snapTimer) clearInterval(snapTimer);
  if (rttTimer) clearInterval(rttTimer);
  snapTimer = rttTimer = null;
}

export function goOffline() {
  stopTunnel();
  S().set({ connection: { kind: 'offline', lastSeen: Date.now() } });
  S().addEvent('WARN', 'tunnel closed by peer');
}

/** Run an allow-listed Action. Handles the reboot watch state for tunnel-dropping actions. */
export function runAction(actionId: string) {
  const action = S().actions.find((a) => a.id === actionId);
  if (!action) return;
  S().set({ runningActionId: actionId });
  S().addEvent('INFO', `action started: ${action.name}`);

  if (action.dropsTunnel) {
    const startedAt = Date.now();
    S().set({
      rebootWatch: {
        actionId,
        actionName: action.name,
        phase: 'sent',
        startedAt,
        offlineAt: null,
        expectedS: action.expectedDurationS,
      },
    });
    setTimeout(() => {
      const w = S().rebootWatch;
      if (!w || w.actionId !== actionId) return;
      S().set({ rebootWatch: { ...w, phase: 'acked' } });
    }, 900);
    setTimeout(() => {
      const w = S().rebootWatch;
      if (!w || w.actionId !== actionId) return;
      goOffline();
      S().set({ rebootWatch: { ...w, phase: 'offline', offlineAt: Date.now() }, runningActionId: null });
    }, 2200);
    const backMs = action.id === 'shutdown' ? -1 : 2200 + action.expectedDurationS * 1000;
    if (backMs > 0) {
      setTimeout(() => {
        const w = S().rebootWatch;
        if (!w || w.actionId !== actionId) return;
        S().set({ rebootWatch: { ...w, phase: 'back' } });
        S().addEvent('INFO', 'agent reachable again');
        startTunnel();
        markRun(actionId, 0, action.expectedDurationS);
      }, backMs);
    }
    return;
  }

  setTimeout(() => {
    markRun(actionId, 0, action.expectedDurationS);
    S().set({ runningActionId: null });
    S().addEvent('INFO', `action finished: ${action.name} · exit 0`);
  }, Math.min(action.expectedDurationS, 4) * 1000);
}

function markRun(actionId: string, exitCode: number, durationS: number) {
  S().set({
    actions: S().actions.map((a) =>
      a.id === actionId ? { ...a, lastRun: { at: Date.now(), exitCode, durationS } } : a,
    ),
  });
}
