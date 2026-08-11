// Store mutations: pairing, alerts, rules, scrollback cap, unpairing.
import { useStore } from '../store/useStore';
import { Agent, Alert, AlertRule } from '../types';

const agent = (id: string): Agent => ({
  id,
  name: `pi-${id}`,
  hostname: `pi-${id}`,
  model: 'Raspberry Pi 5 · 8 GB',
  os: 'Raspberry Pi OS Trixie (64-bit)',
  agentVersion: '1.0.0',
  fingerprintHex: 'AABBCCDDEEFF00112233445566778899',
  fingerprintWords: ['a', 'b', 'c', 'd', 'e', 'f'],
  pairedAt: 1000,
  verifiedAt: 1000,
});

const rule: AlertRule = {
  id: 'r1',
  seriesKey: 'cpu.temp_c',
  op: 'above',
  threshold: 80,
  dwellS: 90,
  severity: 'critical',
  enabled: true,
  notify: true,
};

const alert: Alert = {
  id: 'a1',
  ruleId: 'r1',
  agentId: 'x',
  seriesKey: 'cpu.temp_c',
  severity: 'critical',
  title: 'SoC temperature above 80 °C',
  firedAt: 1000,
  resolvedAt: null,
  acknowledgedAt: null,
  snoozedUntil: null,
  peak: { v: 83.4, t: 1000 },
};

beforeEach(() => {
  useStore.getState().set({
    paired: false,
    agents: [],
    currentAgentId: null,
    devices: [],
    rules: [],
    alerts: [],
    actions: [],
    shellBuffer: [],
    shellSessionStartedAt: null,
    snapshot: null,
    connection: { kind: 'unknown' },
  });
});

describe('pairAgent', () => {
  it('sets paired, makes the new agent current, and seeds this device', () => {
    useStore.getState().pairAgent(agent('x'));
    const s = useStore.getState();
    expect(s.paired).toBe(true);
    expect(s.currentAgentId).toBe('x');
    expect(s.devices.some((d) => d.isThisDevice)).toBe(true);
  });

  it('keeps existing trusted devices when pairing a second Pi', () => {
    useStore.getState().pairAgent(agent('x'));
    const devicesAfterFirst = useStore.getState().devices;
    useStore.getState().pairAgent(agent('y'));
    expect(useStore.getState().devices).toEqual(devicesAfterFirst);
    expect(useStore.getState().agents).toHaveLength(2);
    expect(useStore.getState().currentAgentId).toBe('y');
  });
});

describe('unpairCurrent', () => {
  it('forgets the current agent and falls back to the next', () => {
    useStore.getState().pairAgent(agent('x'));
    useStore.getState().pairAgent(agent('y'));
    useStore.getState().unpairCurrent(); // removes y (current)
    const s = useStore.getState();
    expect(s.agents.map((a) => a.id)).toEqual(['x']);
    expect(s.currentAgentId).toBe('x');
    expect(s.paired).toBe(true);
  });

  it('returns to unpaired state when the last Pi is removed', () => {
    useStore.getState().pairAgent(agent('x'));
    useStore.getState().unpairCurrent();
    expect(useStore.getState().paired).toBe(false);
    expect(useStore.getState().currentAgentId).toBeNull();
  });
});

describe('alerts', () => {
  it('acknowledges', () => {
    useStore.getState().set({ alerts: [alert] });
    useStore.getState().ackAlert('a1');
    expect(useStore.getState().alerts[0].acknowledgedAt).not.toBeNull();
  });

  it('snoozes until the given time', () => {
    useStore.getState().set({ alerts: [alert] });
    useStore.getState().snoozeAlert('a1', 9999);
    expect(useStore.getState().alerts[0].snoozedUntil).toBe(9999);
  });
});

describe('rules', () => {
  it('upsert inserts then updates in place', () => {
    useStore.getState().upsertRule(rule);
    expect(useStore.getState().rules).toHaveLength(1);
    useStore.getState().upsertRule({ ...rule, threshold: 75 });
    expect(useStore.getState().rules).toHaveLength(1);
    expect(useStore.getState().rules[0].threshold).toBe(75);
  });

  it('delete removes by id', () => {
    useStore.getState().upsertRule(rule);
    useStore.getState().deleteRule('r1');
    expect(useStore.getState().rules).toHaveLength(0);
  });
});

describe('shell scrollback', () => {
  it('appends and caps at 10 000 lines (§11.4: never cleared by errors)', () => {
    useStore.getState().appendShell(Array.from({ length: 10_500 }, (_, i) => `line ${i}`));
    const buf = useStore.getState().shellBuffer;
    expect(buf).toHaveLength(10_000);
    expect(buf[buf.length - 1]).toBe('line 10499');
  });
});
