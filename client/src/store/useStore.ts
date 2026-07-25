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
}

export const useStore = create<State>((set, get) => ({
  hydrated: false,
  paired: false,
  agents: [],
  currentAgentId: null,
  devices: [],

  connection: { kind: 'unknown' },
  rttHistory: [],
  events: [],
  snapshot: null,

  dashboardRange: '1h',

  rules: [],
  alerts: [],

  actions: [],
  runningActionId: null,
  rebootWatch: null,

  shellBuffer: [],
  shellSessionStartedAt: null,

  firstRunCardDismissed: false,

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
}));
