import { create } from 'zustand';
import {
  Agent, AgentAction, Alert, AlertRule, ConnectionState, LogEvent, Snapshot,
  TimeRange, TrustedDevice,
} from '../types';

export type RebootPhase = 'sent' | 'acked' | 'offline' | 'back';

export interface ConnectDevice {
  id: string;
  name: string;
  online: boolean;
  /** Absolute URL of the device's page on connect.raspberrypi.com. */
  url: string;
}

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
  /** The user has set the Face ID switch themselves (else it starts off). */
  bioUserSet?: boolean;
  animateCharts: boolean;
  telemetryIntervalS: number;
}

interface State {
  hydrated: boolean;

  /** Raspberry Pi Connect (cloud) session. Cookies live in the WKWebView store;
   *  this flag just remembers the user reached the signed-in device list, so the
   *  "Sign in" button can jump straight there instead of re-opening the pop-up. */
  connectSignedIn: boolean;
  /** Signed-in account email, when Connect exposes it. Cosmetic. */
  connectEmail: string | null;
  /** Live result of the background session check (not persisted). */
  connectStatus: 'checking' | 'signedIn' | 'signedOut';
  /** The account's devices as last read from connect.raspberrypi.com/devices. */
  connectDevices: ConnectDevice[];
  /** Bump to make the background session re-check (e.g. after pop-up login). */
  connectCheckNonce: number;
  /** A live GUI/SSH session is on screen (pauses the background session check). */
  connectSessionActive: boolean;
  /** The saved Connect session has been put back into the WebView cookie store
   *  (pages opened before this would look signed-out). */
  connectCookiesReady: boolean;
  /** Monitor over SSH: where to connect (the password lives in the Keychain). */
  sshMonitor: SshMonitorTarget | null;
  /** Connect device the Monitor follows (null → the first online one). */
  monitorDeviceId: string | null;
  /** Name of the Pi being monitored through Connect's remote shell, while that
   *  source is in use (null when Monitor runs over SSH / an agent, or not at all). */
  connectMonitorName: string | null;
  /** Last picture of each Pi's desktop (by device URL), taken during a session
   *  and shown on its card. Memory only — never persisted — so it's gone once
   *  the app is closed from the app switcher. */
  deviceSnapshots: Record<string, string>;

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

  /** Saved sign-in per Agent. Presence = "don't ask again". */
  credentials: Record<string, { username: string; password: string }>;

  /** Real Agent endpoint per Agent id. Presence = a real Pi (not the demo). */
  endpoints: Record<string, { ip: string; port: string; token: string; hostname?: string }>;

  settings: Settings;

  // mutations
  set: (partial: Partial<State>) => void;
  setSettings: (partial: Partial<Settings>) => void;
  setConnectAuth: (signedIn: boolean, email?: string | null) => void;
  signOutConnect: () => void;
  addEvent: (level: LogEvent['level'], message: string) => void;
  pairAgent: (agent: Agent) => void;
  unpairCurrent: () => void;
  saveCredentials: (agentId: string, username: string, password: string) => void;
  clearCredentials: (agentId: string) => void;
  ackAlert: (id: string) => void;
  snoozeAlert: (id: string, untilMs: number) => void;
  upsertRule: (rule: AlertRule) => void;
  deleteRule: (id: string) => void;
  appendShell: (lines: string[]) => void;
  toggleWidget: (id: string) => void;
}

import { CAPTURE_ENABLED } from '../dev/capture';

export interface SshMonitorTarget {
  host: string;
  port: number;
  username: string;
  /** The Pi's SSH host key, saved on first connect (trust on first use). */
  hostKey: string | null;
  /** The Pi's hostname, read over SSH — shown as the Monitor title. */
  name: string | null;
}

const CAPTURE_AGENT = {
  id: 'agent-demo', name: 'pi5-livingroom', hostname: 'pi5-livingroom',
  model: 'Raspberry Pi 5 · 8 GB', os: 'Raspberry Pi OS Trixie (64-bit)',
  agentVersion: '1.0.0', fingerprintHex: '9F2C4A81D30E77B51CE488026BAFD915',
  fingerprintWords: ['anchor', 'velvet', 'piston', 'marina', 'cobalt', 'thistle'],
  pairedAt: Date.now() - 200_000_000, verifiedAt: Date.now() - 200_000_000,
};

/** Signed in to Raspberry Pi Connect — or, at launch, signed in last time and
 *  still being checked. The app opens straight to the saved devices/Monitor on
 *  that basis (no waiting on the network); a failed check signs out as usual. */
export const connectLive = (s: Pick<State, 'connectStatus' | 'connectSignedIn'>): boolean =>
  s.connectStatus === 'signedIn' || (s.connectStatus === 'checking' && s.connectSignedIn);

export const useStore = create<State>((set, get) => ({
  hydrated: CAPTURE_ENABLED,
  connectSignedIn: false,
  connectEmail: null,
  connectStatus: 'checking',
  connectDevices: [],
  connectCheckNonce: 0,
  connectSessionActive: false,
  connectCookiesReady: false,
  sshMonitor: null,
  monitorDeviceId: null,
  connectMonitorName: null,
  deviceSnapshots: {},
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

  rules: CAPTURE_ENABLED ? require('../dev/captureSeed').DEFAULT_RULES : [],
  alerts: [],

  actions: CAPTURE_ENABLED ? require('../dev/captureSeed').DEFAULT_ACTIONS : [],
  runningActionId: null,
  rebootWatch: null,

  shellBuffer: [],
  shellSessionStartedAt: null,

  firstRunCardDismissed: false,

  selectedWidgets: [],

  credentials: {},

  endpoints: {},

  settings: {
    theme: 'system',
    terminalFontSize: 13,
    requireBioShellDesktop: false, // off until the user turns it on
    animateCharts: true,
    telemetryIntervalS: 5,
  },

  set: (partial) => set(partial),
  setSettings: (partial) => set({ settings: { ...get().settings, ...partial } }),

  setConnectAuth: (signedIn, email) =>
    set({ connectSignedIn: signedIn, connectEmail: email !== undefined ? email : get().connectEmail }),

  signOutConnect: () =>
    set({ connectSignedIn: false, connectEmail: null, connectStatus: 'signedOut', connectDevices: [] }),

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

  saveCredentials: (agentId, username, password) =>
    set({ credentials: { ...get().credentials, [agentId]: { username, password } } }),

  clearCredentials: (agentId) => {
    const next = { ...get().credentials };
    delete next[agentId];
    set({ credentials: next });
  },

  toggleWidget: (id) => {
    const cur = get().selectedWidgets;
    set({ selectedWidgets: cur.includes(id) ? cur.filter((w) => w !== id) : [...cur, id] });
  },
}));
