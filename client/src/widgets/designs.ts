// Widget catalog DATA — no React/Native imports, so it is safe to unit-test and
// cheap to import. The live renderer lives in catalog.tsx.

export type WidgetFamily = 'small' | 'medium' | 'circular' | 'rectangular' | 'inline';

export interface WidgetDesign {
  id: string;
  family: WidgetFamily;
  name: string;
}

export const FAMILY_META: Record<WidgetFamily, { title: string; blurb: string; w: number; h: number }> = {
  small: { title: 'Home Screen · Small', blurb: '2×2 squares for one number that matters', w: 152, h: 152 },
  medium: { title: 'Home Screen · Medium', blurb: '4×2 cards with charts and stat grids', w: 318, h: 152 },
  circular: { title: 'Lock Screen · Circular', blurb: 'Monochrome gauges beside the clock', w: 76, h: 76 },
  rectangular: { title: 'Lock Screen · Rectangular', blurb: 'A value with its trend, under the clock', w: 172, h: 76 },
  inline: { title: 'Lock Screen · Inline', blurb: 'One line above the clock', w: 210, h: 30 },
};

export const CATALOG: WidgetDesign[] = [
  // Home Small — 12
  { id: 'sm-temp-ring', family: 'small', name: 'Temp ring' },
  { id: 'sm-temp-big', family: 'small', name: 'Temp' },
  { id: 'sm-cpu-spark', family: 'small', name: 'CPU trend' },
  { id: 'sm-load-spark', family: 'small', name: 'Load trend' },
  { id: 'sm-mem-bar', family: 'small', name: 'Memory' },
  { id: 'sm-disk-ring', family: 'small', name: 'Disk ring' },
  { id: 'sm-status', family: 'small', name: 'Status' },
  { id: 'sm-net', family: 'small', name: 'Network' },
  { id: 'sm-uptime', family: 'small', name: 'Uptime' },
  { id: 'sm-terminal', family: 'small', name: 'Terminal' },
  { id: 'sm-bloom', family: 'small', name: 'Bloom' },
  { id: 'sm-minimal', family: 'small', name: 'Minimal' },
  // Home Medium — 8
  { id: 'md-overview', family: 'medium', name: 'Overview' },
  { id: 'md-temp-chart', family: 'medium', name: 'Temp chart' },
  { id: 'md-net-chart', family: 'medium', name: 'Network chart' },
  { id: 'md-quad', family: 'medium', name: 'Four stats' },
  { id: 'md-status-spark', family: 'medium', name: 'Status + CPU' },
  { id: 'md-graphwall', family: 'medium', name: 'Graph wall' },
  { id: 'md-terminal', family: 'medium', name: 'Terminal wide' },
  { id: 'md-bloom', family: 'medium', name: 'Bloom hero' },
  // Lock Circular — 6
  { id: 'ci-temp', family: 'circular', name: 'Temp' },
  { id: 'ci-cpu', family: 'circular', name: 'CPU' },
  { id: 'ci-mem', family: 'circular', name: 'Memory' },
  { id: 'ci-disk', family: 'circular', name: 'Disk' },
  { id: 'ci-load', family: 'circular', name: 'Load' },
  { id: 'ci-status', family: 'circular', name: 'Status' },
  // Lock Rectangular — 5
  { id: 're-temp', family: 'rectangular', name: 'Temp trend' },
  { id: 're-cpu', family: 'rectangular', name: 'CPU trend' },
  { id: 're-net', family: 'rectangular', name: 'Net rates' },
  { id: 're-status', family: 'rectangular', name: 'Status line' },
  { id: 're-load', family: 'rectangular', name: 'Load averages' },
  // Lock Inline — 4
  { id: 'in-temp', family: 'inline', name: 'Temp' },
  { id: 'in-cpu', family: 'inline', name: 'CPU' },
  { id: 'in-status', family: 'inline', name: 'Status' },
  { id: 'in-uptime', family: 'inline', name: 'Uptime' },
];
