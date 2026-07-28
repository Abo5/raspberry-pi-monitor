// Dev-only screenshot harness. When CAPTURE_ENABLED is true the app seeds a
// paired demo agent and auto-walks every screen on a timer, so a full visual QA
// set can be captured without taps, deep links, or system dialogs. Ships OFF.
export const CAPTURE_ENABLED = false;
export const CAPTURE_STEP_MS = 6000;
export const CAPTURE_FIRST_MS = 8000;

/** [tabName, { screen, params? }] fed to the root navigation ref. */
export const CAPTURE_STEPS: { name: string; target: [string, any] }[] = [
  { name: '01_devices', target: ['DevicesTab', { screen: 'DevicesHome' }] },
  { name: '02_widgets', target: ['WidgetsTab', { screen: 'WidgetGallery' }] },
  { name: '03_monitor', target: ['MonitorTab', { screen: 'Dashboard' }] },
  { name: '04_metric', target: ['MonitorTab', { screen: 'MetricDetail', params: { seriesKey: 'cpu.temp_c' } }] },
  { name: '05_control', target: ['ControlTab', { screen: 'ControlHub' }] },
  { name: '06_actions', target: ['ControlTab', { screen: 'Actions' }] },
  { name: '07_alerts', target: ['AlertsTab', { screen: 'Alerts' }] },
  { name: '08_rules', target: ['AlertsTab', { screen: 'Rules' }] },
  { name: '09_ruleeditor', target: ['AlertsTab', { screen: 'RuleEditor', params: {} }] },
  { name: '10_settings', target: ['SettingsTab', { screen: 'Settings' }] },
  { name: '11_security', target: ['SettingsTab', { screen: 'SecuritySettings' }] },
  { name: '12_appearance', target: ['SettingsTab', { screen: 'AppearanceSettings' }] },
  { name: '13_devices_keys', target: ['SettingsTab', { screen: 'DevicesKeys' }] },
  { name: '14_diagnostics', target: ['SettingsTab', { screen: 'Diagnostics' }] },
  { name: '15_agentdetail', target: ['DevicesTab', { screen: 'AgentDetail', params: { agentId: 'agent-demo' } }] },
];
