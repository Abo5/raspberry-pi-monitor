import { create } from 'zustand';
import {
  Agent, AgentAction, Alert, AlertRule, ConnectionState, LogEvent, Snapshot,
  TimeRange, TrustedDevice,
} from '../types';

export type RebootPhase = 'sent' | 'acked' | 'offline' | 'back';

export interface RebootWatch {
  actionId: string;
  actionName: string;
  phase: RebootPhase;
  startedAt: number;
  offlineAt: number | null;
  expectedS: number;
}

interface Settings {
  theme: 'system' | 'dark' | 'light';
  terminalFontSize: number;
  requireBioShellDesktop: boolean;
  animateCharts: boolean;
  telemetryIntervalS: number;
}

interface State {
  hydrated: boolean;
  paired: boolean;
  agents: Agent[];
  currentAgentId: string | null;
  devices: TrustedDevice[];

  connection: ConnectionState;
  rttHistory: { t: number; v: number }[];
  events: LogEvent[];
  snapshot: Snapshot | null;

  dashboardRange: TimeRange;

  rules: AlertRule[];
  alerts: Alert[];

  actions: AgentAction[];
  runningActionId: string | null;
  rebootWatch: RebootWatch | null;

  shellBuffer: string[]; // scrollback — never cleared by errors (§11.4)
  shellSessionStartedAt: number | null;

  firstRunCardDismissed: boolean;

  /** Widget designs the user picked in the gallery (design ids). */
  selectedWidgets: string[];

  settings: Settings;

  // mutations
  set: (partial: Partial<State>) => void;
  setSettings: (partial: Partial<Settings>) => void;
  addEvent: (level: LogEvent['level'], message: string) => void;
  pairAgent: (agent: Agent) => void;
  unpairCurrent: () => void;
  ackAlert: (id: string) => void;
  snoozeAlert: (id: string, untilMs: number) => void;
  upsertRule: (rule: AlertRule) => void;
  deleteRule: (id: string) => void;
  appendShell: (lines: string[]) => void;
  toggleWidget: (id: string) => void;
}

import { CAPTURE_ENABLED } from '../dev/capture';

const CAPTURE_AGENT = {
  id: 'agent-demo', name: 'pi5-livingroom', hostname: 'pi5-livingroom',
  model: 'Raspberry Pi 5 · 8 GB', os: 'Raspberry Pi OS Trixie (64-bit)',
  agentVersion: '1.0.0', fingerprintHex: '9F2C4A81D30E77B51CE488026BAFD915',
  fingerprintWords: ['anchor', 'velvet', 'piston', 'marina', 'cobalt', 'thistle'],
  pairedAt: Date.now() - 200_000_000, verifiedAt: Date.now() - 200_000_000,
};

export const useStore = create<State>((set, get) => ({
  hydrated: CAPTURE_ENABLED,
  paired: CAPTURE_ENABLED,
  agents: CAPTURE_ENABLED ? [CAPTURE_AGENT] : [],
  currentAgentId: CAPTURE_ENABLED ? 'agent-demo' : null,
  devices: CAPTURE_ENABLED
    ? [{ id: 'this-device', name: 'iPhone', isThisDevice: true, pairedAt: Date.now(), lastSeen: Date.now() }]
    : [],

  connection: { kind: 'unknown' },
  rttHistory: [],
  events: [],
  snapshot: null,

  dashboardRange: '1h',

  rules: CAPTURE_ENABLED ? require('../sim/seed').DEFAULT_RULES : [],
  alerts: [],

  actions: CAPTURE_ENABLED ? require('../sim/seed').DEFAULT_ACTIONS : [],
  runningActionId: null,
  rebootWatch: null,

  shellBuffer: [],
  shellSessionStartedAt: null,

  firstRunCardDismissed: false,

  selectedWidgets: [],

  settings: {
    theme: 'system',
    terminalFontSize: 13,
    requireBioShellDesktop: true,
    animateCharts: true,
    telemetryIntervalS: 5,
  },

  set: (partial) => set(partial),
  setSettings: (partial) => set({ settings: { ...get().settings, ...partial } }),

  addEvent: (level, message) =>
    set({ events: [{ t: Date.now(), level, message }, ...get().events].slice(0, 50) }),

  pairAgent: (agent) =>
    set({
      paired: true,
      agents: [...get().agents, agent],
      currentAgentId: agent.id,
      devices: get().devices.length
        ? get().devices
        : [
            {
              id: 'this-device',
              name: 'iPhone',
              isThisDevice: true,
              pairedAt: Date.now(),
              lastSeen: Date.now(),
            },
          ],
    }),

  unpairCurrent: () => {
    const { agents, currentAgentId } = get();
    const rest = agents.filter((a) => a.id !== currentAgentId);
    set({
      agents: rest,
      currentAgentId: rest[0]?.id ?? null,
      paired: rest.length > 0,
      snapshot: null,
      connection: { kind: 'unknown' },
      alerts: [],
      shellBuffer: [],
      shellSessionStartedAt: null,
    });
  },

  ackAlert: (id) =>
    set({
      alerts: get().alerts.map((a) => (a.id === id ? { ...a, acknowledgedAt: Date.now() } : a)),
    }),

  snoozeAlert: (id, untilMs) =>
    set({
      alerts: get().alerts.map((a) => (a.id === id ? { ...a, snoozedUntil: untilMs } : a)),
    }),

  upsertRule: (rule) => {
    const rules = get().rules;
    const i = rules.findIndex((r) => r.id === rule.id);
    set({ rules: i >= 0 ? rules.map((r) => (r.id === rule.id ? rule : r)) : [...rules, rule] });
  },

  deleteRule: (id) => set({ rules: get().rules.filter((r) => r.id !== id) }),

  appendShell: (lines) => set({ shellBuffer: [...get().shellBuffer, ...lines].slice(-10_000) }),

  toggleWidget: (id) => {
    const cur = get().selectedWidgets;
    set({ selectedWidgets: cur.includes(id) ? cur.filter((w) => w !== id) : [...cur, id] });
  },
}));
