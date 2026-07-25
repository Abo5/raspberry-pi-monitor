// Default rules and allow-list, seeded on pairing. The Actions list mirrors the
// UX spec's example configuration (docs/07-UX-SPEC.md §12) — on the real system
// it comes from the Agent's config file on the Pi.
import { AgentAction, AlertRule } from '../types';

export const DEFAULT_RULES: AlertRule[] = [
  {
    id: 'rule-temp-critical',
    seriesKey: 'cpu.temp_c',
    op: 'above',
    threshold: 80,
    dwellS: 90,
    severity: 'critical',
    enabled: true,
    notify: true,
  },
  {
    id: 'rule-disk-warning',
    seriesKey: 'disk.used_pct',
    op: 'above',
    threshold: 85,
    dwellS: 300,
    severity: 'warning',
    enabled: true,
    notify: true,
  },
];

export const DEFAULT_ACTIONS: AgentAction[] = [
  {
    id: 'restart-ha',
    category: 'Services',
    name: 'Restart Home Assistant',
    command: 'systemctl restart home-assistant',
    expectedDurationS: 8,
    destructive: false,
    dropsTunnel: false,
  },
  {
    id: 'restart-pihole',
    category: 'Services',
    name: 'Restart Pi-hole',
    command: 'systemctl restart pihole-FTL',
    expectedDurationS: 4,
    destructive: false,
    dropsTunnel: false,
  },
  {
    id: 'apt-upgrade',
    category: 'Maintenance',
    name: 'Update packages',
    command: 'apt-get -y upgrade',
    expectedDurationS: 240,
    destructive: false,
    dropsTunnel: false,
  },
  {
    id: 'reboot',
    category: 'Power',
    name: 'Reboot',
    command: 'sudo systemctl reboot',
    expectedDurationS: 50,
    destructive: true,
    dropsTunnel: true,
    confirmText: 'The Pi will go offline for about 50 seconds. Anything running on it stops, including your shell session.',
  },
  {
    id: 'shutdown',
    category: 'Power',
    name: 'Shut down',
    command: 'sudo systemctl poweroff',
    expectedDurationS: 15,
    destructive: true,
    dropsTunnel: true,
    confirmText: 'The Pi will power off. It needs physical access to restart.',
  },
];
