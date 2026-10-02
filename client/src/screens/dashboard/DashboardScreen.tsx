// Dashboard (§7) — the hero screen. Vertical order is deliberate:
// connection → the four numbers that matter → what I can do → what is wrong → why.
import React, { useMemo, useState } from 'react';
import { ActionSheetIOS, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { BlurView } from 'expo-blur';
import { GlassBackground } from '../../components/Glass';
import { WidgetPreview } from '../../widgets/catalog';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { useStore } from '../../store/useStore';
import { ConnectionBanner } from '../../components/ConnectionBanner';
import { AgentSwitcher } from '../../components/AgentSwitcher';
import { TimeRangeChips } from '../../components/TimeRangeChips';
import { StatTile } from '../../components/StatTile';
import { MetricChart } from '../../components/MetricChart';
import { AlertRow } from '../../components/AlertRow';
import { Sparkline } from '../../components/Sparkline';
import { Skeleton } from '../../components/States';
import { RANGE_MS, SeriesKey, TimeRange } from '../../types';
import { rollupNote } from '../../lib/series';
import { useSeriesHistory } from '../../net/useSeriesHistory';
import { sshSparkline } from '../../net/sshMonitor';
import { fmtBps, fmtPct, fmtTemp } from '../../lib/format';

const QUICK: { icon: keyof typeof Ionicons.glyphMap; label: string; target: string }[] = [
  { icon: 'desktop-outline', label: 'Desktop', target: 'Desktop' },
  { icon: 'terminal-outline', label: 'Shell', target: 'Shell' },
  { icon: 'refresh-outline', label: 'Restart', target: 'Actions' },
  { icon: 'flash-outline', label: 'Actions', target: 'Actions' },
];

// Widget components shown on Monitor (moved here from the old Widgets tab).
const GLANCE_SMALL = ['sm-temp-ring', 'sm-cpu-spark', 'sm-mem-bar', 'sm-disk-ring', 'sm-load-spark', 'sm-net'];
const GLANCE_MEDIUM = ['md-overview', 'md-temp-chart'];

export function DashboardScreen() {
  const { c, type } = useTheme();
  const nav = useNavigation<any>();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const tileW = (width - 32 - 12) / 2;

  const agent = useStore((s) => s.agents.find((a) => a.id === s.currentAgentId));
  const ssh = useStore((s) => s.sshMonitor);
  // Live through Raspberry Pi Connect's remote shell (automatic after sign-in).
  const connectName = useStore((s) => (s.sshMonitor ? null : s.connectMonitorName));
  const connectDevices = useStore((s) => s.connectDevices);
  // Where the numbers come from: SSH, Connect, or a paired monitoring agent.
  const hasSource = !!ssh || !!connectName || !!agent;
  const piName = ssh ? ssh.name ?? ssh.host : connectName ?? agent?.name ?? 'your Pi';

  // Monitoring through Connect: pick which Pi to follow, or switch to SSH.
  const pickConnectDevice = () => {
    const options = [...connectDevices.map((d) => d.name), 'Use an SSH login instead', 'Cancel'];
    ActionSheetIOS.showActionSheetWithOptions(
      { options, cancelButtonIndex: options.length - 1, title: 'Monitor which Pi?', userInterfaceStyle: 'dark' },
      (i) => {
        if (i < connectDevices.length) setStore({ monitorDeviceId: connectDevices[i].id });
        else if (i === connectDevices.length) nav.navigate('SshMonitorSetup');
      },
    );
  };
  const connection = useStore((s) => s.connection);
  const snapshot = useStore((s) => s.snapshot);
  const range = useStore((s) => s.dashboardRange);
  const alerts = useStore((s) => s.alerts);
  const setStore = useStore((s) => s.set);
  const firstRunCardDismissed = useStore((s) => s.firstRunCardDismissed);
  const [showSwitcher, setShowSwitcher] = useState(false);
  // The one-time note (§20): only within the first hour after pairing.
  const showFirstRun = !firstRunCardDismissed && agent != null && Date.now() - agent.pairedAt < 3_600_000;

  const connected = connection.kind === 'connected';
  const offline = connection.kind === 'offline';
  const now = Date.now();

  // Short ranges re-sample on every Snapshot (live tail); long ranges are stable.
  const tick = RANGE_MS[range] <= RANGE_MS['1h'] ? snapshot?.receivedAt : Math.floor(now / 60_000);
  // Real history from the Agent's /series when connected.
  const rangeMs = RANGE_MS[range];
  const series: Record<SeriesKey, { t: number; v: number }[]> = {
    'cpu.util_pct': useSeriesHistory('cpu.util_pct', rangeMs, tick),
    'cpu.temp_c': useSeriesHistory('cpu.temp_c', rangeMs, tick),
    'mem.used_pct': useSeriesHistory('mem.used_pct', rangeMs, tick),
    'net.rx_bps': useSeriesHistory('net.rx_bps', rangeMs, tick),
    'net.tx_bps': useSeriesHistory('net.tx_bps', rangeMs, tick),
  } as Record<SeriesKey, { t: number; v: number }[]>;

  const v = snapshot?.values;
  // Widget sparklines: the SSH history, or the agent series we already fetched.
  const glanceHistory = (k: SeriesKey, points: number) => {
    if (ssh || connectName) return sshSparkline(k, points);
    const list = (series as Partial<Record<SeriesKey, { t: number; v: number }[]>>)[k] ?? [];
    return list.slice(-points);
  };
  const active = alerts.filter((a) => a.resolvedAt == null);
  const rx = v ? fmtBps(v['net.rx_bps'] ?? 0) : null;
  const tx = v ? fmtBps(v['net.tx_bps'] ?? 0) : null;
  const temp = v?.['cpu.temp_c'] ?? 0;
  const thermalColor =
    temp >= 80 ? c.thermal.steps[4] : temp >= 74 ? c.thermal.steps[3] : temp >= 67 ? c.thermal.steps[2] : temp >= 60 ? c.thermal.steps[1] : temp >= 50 ? c.thermal.steps[0] : undefined;

  return (
    <View style={{ flex: 1, backgroundColor: c.surface.canvas, paddingTop: insets.top }}>
      <GlassBackground base="#000000" strength={0.9} />
      {/* Header — large title (tap it to pick the Pi) and Live Commands */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 6 }}>
        <TouchableOpacity
          style={{ flexDirection: 'row', alignItems: 'center', flexShrink: 1 }}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          onPress={() => (connectName ? pickConnectDevice() : ssh || !agent ? nav.navigate('SshMonitorSetup') : setShowSwitcher(true))}
          accessibilityRole="button"
        >
          <Text style={[type.display, { color: '#FFFFFF', fontSize: 30 }]} numberOfLines={1}>
            {hasSource ? piName : 'Monitor'}
          </Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
        <TouchableOpacity onPress={() => nav.navigate('LiveCommands')} accessibilityRole="button" accessibilityLabel="Live Commands">
          <View style={{ width: 46, height: 46, borderRadius: 23, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: 'rgba(255,255,255,0.06)' }}>
            <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
            <Ionicons name="terminal-outline" size={20} color="#EDEDF0" />
          </View>
        </TouchableOpacity>
      </View>

      {hasSource && (
        <View style={{ marginHorizontal: 16, marginTop: 8, borderRadius: 14, overflow: 'hidden' }}>
          <ConnectionBanner onPress={() => nav.navigate('Diagnostics')} />
        </View>
      )}

      {!hasSource ? (
        <LinkMonitoring onStart={() => nav.navigate('SshMonitorSetup')} />
      ) : (
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 130 }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={() => {}} tintColor={c.text.tertiary} />}
      >
        <TimeRangeChips value={range} onChange={(r: TimeRange) => setStore({ dashboardRange: r })} />
        <Text style={[type.caption, { color: c.text.tertiary, marginTop: 6, marginBottom: 12 }]}>
          {rollupNote(RANGE_MS[range])}
        </Text>

        {/* Tile grid */}
        {!v ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} style={{ width: tileW, height: 120 }} />
            ))}
          </View>
        ) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
            <StatTile
              eyebrow="CPU"
              value={fmtPct(v['cpu.util_pct'] ?? 0)}
              unit="%"
              samples={series['cpu.util_pct']}
              width={tileW}
              dimmed={offline}
              onPress={() => nav.navigate('MetricDetail', { seriesKey: 'cpu.util_pct' })}
            />
            <StatTile
              eyebrow="SOC TEMP"
              value={fmtTemp(temp)}
              unit="°C"
              samples={series['cpu.temp_c']}
              width={tileW}
              thermalColor={thermalColor}
              sparkColor={thermalColor}
              dimmed={offline}
              onPress={() => nav.navigate('MetricDetail', { seriesKey: 'cpu.temp_c' })}
            />
            <StatTile
              eyebrow="MEMORY"
              value={fmtPct(v['mem.used_pct'] ?? 0)}
              unit="%"
              secondary={memLine(v['mem.used_pct'], v['mem.available_bytes'])}
              samples={series['mem.used_pct']}
              width={tileW}
              dimmed={offline}
              onPress={() => nav.navigate('MetricDetail', { seriesKey: 'mem.used_pct' })}
            />
            <StatTile
              eyebrow="DISK  /"
              value=""
              gauge={v['disk.used_pct'] ?? 0}
              width={tileW}
              dimmed={offline}
              onPress={() => nav.navigate('MetricDetail', { seriesKey: 'disk.used_pct' })}
            />
            {/* Wide network tile */}
            <View style={{ width: tileW * 2 + 12 }}>
              <StatTileWide
                rx={rx!}
                tx={tx!}
                samples={series['net.rx_bps']}
                width={tileW * 2 + 12}
                dimmed={offline}
                onPress={() => nav.navigate('MetricDetail', { seriesKey: 'net.rx_bps' })}
              />
            </View>
          </View>
        )}

        {/* One-time note: the single most important expectation to set (§20) */}
        {showFirstRun && (
          <View
            style={{
              flexDirection: 'row',
              marginTop: 16,
              padding: 14,
              borderRadius: 12,
              backgroundColor: c.surface.raised,
              borderWidth: 1,
              borderColor: c.border.subtle,
            }}
          >
            <Ionicons name="information-circle" size={18} color={c.status.info} />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={[type.bodyEmph, { color: c.text.primary }]}>History starts now.</Text>
              <Text style={[type.subhead, { color: c.text.secondary, marginTop: 2 }]}>
                Charts will fill in as your Pi records. Come back in an hour for a real shape.
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => setStore({ firstRunCardDismissed: true })}
              accessibilityRole="button"
              accessibilityLabel="Dismiss"
              hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
            >
              <Ionicons name="close" size={16} color={c.text.tertiary} />
            </TouchableOpacity>
          </View>
        )}

        {/* Quick actions — these talk to the monitoring agent, so only with one. */}
        {!ssh && !!agent && (
          <>
        <Text style={[type.micro, { color: c.text.tertiary, marginTop: 24, marginBottom: 8 }]}>QUICK ACTIONS</Text>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {QUICK.map((q) => (
            <TouchableOpacity
              key={q.label}
              disabled={!connected}
              onPress={() => nav.navigate('ControlTab', { screen: q.target })}
              accessibilityRole="button"
              style={{
                flex: 1,
                height: 72,
                borderRadius: 10,
                backgroundColor: c.surface.raised,
                borderWidth: 1,
                borderColor: c.border.subtle,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: connected ? 1 : 0.45,
              }}
            >
              <Ionicons name={q.icon} size={20} color={q.label === 'Restart' ? c.status.critical : c.accent.base} />
              <Text style={[type.caption, { color: c.text.secondary, marginTop: 4 }]}>{q.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
          </>
        )}
        {!connected && (
          <Text style={[type.footnote, { color: c.text.tertiary, marginTop: 6 }]}>
            {offline ? `${piName === 'your Pi' ? 'Your Pi' : piName} is offline` : 'Waiting for a connection'}
          </Text>
        )}

        {/* Active alerts */}
        {active.length > 0 && (
          <>
            <Text style={[type.micro, { color: c.text.tertiary, marginTop: 24, marginBottom: 8 }]}>
              ACTIVE ALERTS  ({active.length})
            </Text>
            <View style={{ gap: 8 }}>
              {active.slice(0, 3).map((a) => (
                <AlertRow
                  key={a.id}
                  alert={a}
                  agentName={piName}
                  onPress={() => nav.navigate('AlertsTab', { screen: 'AlertDetail', params: { alertId: a.id } })}
                />
              ))}
            </View>
          </>
        )}

        {/* At a glance — the widget components, drawn only from the Pi's real readings */}
        {!!v && (
          <>
            <Text style={[type.micro, { color: c.text.tertiary, marginTop: 24, marginBottom: 4 }]}>AT A GLANCE</Text>
            <Text style={[type.caption, { color: c.text.tertiary, marginBottom: 12 }]}>Live from {piName}.</Text>
            <View style={{ width: 318, alignSelf: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
              {GLANCE_SMALL.map((id) => (
                <WidgetPreview key={id} id={id} agentName={piName} live={v} history={glanceHistory} />
              ))}
            </View>
            <View style={{ width: 318, alignSelf: 'center', gap: 14, marginTop: 14 }}>
              {GLANCE_MEDIUM.map((id) => (
                <WidgetPreview key={id} id={id} agentName={piName} live={v} history={glanceHistory} />
              ))}
            </View>
          </>
        )}

        {/* The one Dashboard chart: temperature (hard hardware thresholds) */}
        <View style={{ marginTop: 24 }}>
          <MetricChart
            title="SOC TEMPERATURE"
            samples={series['cpu.temp_c']}
            unit="°C"
            formatValue={(x) => fmtTemp(x)}
            thresholds={[
              { value: 80, color: c.status.warning },
              { value: 85, color: c.status.critical },
            ]}
          />
        </View>
      </ScrollView>
      )}

      <AgentSwitcher
        visible={showSwitcher}
        onClose={() => setShowSwitcher(false)}
        onSeeAll={() => nav.navigate('AgentList')}
      />
    </View>
  );
}

function StatTileWide({
  rx, tx, samples, width, dimmed, onPress,
}: {
  rx: { value: string; unit: string };
  tx: { value: string; unit: string };
  samples: { t: number; v: number }[];
  width: number;
  dimmed?: boolean;
  onPress?: () => void;
}) {
  const { c, type, radius } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      style={{
        height: 120,
        padding: 16,
        borderRadius: radius.m,
        backgroundColor: c.surface.raised,
        borderWidth: 1,
        borderColor: c.border.subtle,
      }}
    >
      <Text style={[type.micro, { color: c.text.tertiary }]}>NETWORK</Text>
      <View style={{ flexDirection: 'row', marginTop: 6, gap: 24 }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
          <Ionicons name="arrow-down" size={13} color={c.viz.categorical[0]} />
          <Text style={[type.metricM, { color: dimmed ? c.text.secondary : c.text.primary, marginLeft: 3 }]}>
            {rx.value}
          </Text>
          <Text style={[type.micro, { color: c.text.tertiary, marginLeft: 2 }]}>{rx.unit}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
          <Ionicons name="arrow-up" size={13} color={c.viz.categorical[1]} />
          <Text style={[type.metricM, { color: dimmed ? c.text.secondary : c.text.primary, marginLeft: 3 }]}>
            {tx.value}
          </Text>
          <Text style={[type.micro, { color: c.text.tertiary, marginLeft: 2 }]}>{tx.unit}</Text>
        </View>
      </View>
      <View style={{ flex: 1 }} />
      <Sparkline samples={samples} width={width - 32} height={28} dimmed={dimmed} />
    </TouchableOpacity>
  );
}

// Monitor reads the Pi's numbers over SSH. Until it's set up, invite the user
// to sign in to their Pi — nothing needs installing on it.
function LinkMonitoring({ onStart }: { onStart: () => void }) {
  const { c, type } = useTheme();
  const row = (icon: keyof typeof Ionicons.glyphMap, text: string) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 }}>
      <Ionicons name={icon} size={18} color="#C9B8FF" />
      <Text style={[type.subhead, { color: c.text.secondary, flex: 1 }]}>{text}</Text>
    </View>
  );
  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 130 }}>
      <View style={{ borderRadius: 22, overflow: 'hidden', padding: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: 'rgba(255,255,255,0.05)' }}>
        <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: 'rgba(138,107,234,0.25)', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="pulse" size={28} color="#C9B8FF" />
        </View>
        <Text style={[type.title2, { color: '#FFFFFF', marginTop: 14 }]}>Turn on live monitoring</Text>
        <Text style={[type.subhead, { color: c.text.secondary, marginTop: 6 }]}>
          Sign in to your Pi over SSH and see it live — updated every few seconds.
        </Text>
        {row('hardware-chip-outline', 'CPU use, temperature and clock speed')}
        {row('server-outline', 'Memory and disk space')}
        {row('swap-vertical-outline', 'Network download and upload')}
        {row('lock-closed-outline', 'Password stays in this iPhone’s Keychain')}

        <Pressable onPress={onStart} accessibilityRole="button"
          style={({ pressed }) => ({ marginTop: 20, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? '#7A5BDA' : '#8A6BEA', flexDirection: 'row', gap: 8 })}
        >
          <Ionicons name="terminal-outline" size={18} color="#FFFFFF" />
          <Text style={[type.bodyEmph, { color: '#FFFFFF' }]}>Connect over SSH</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

/** "3.1 / 7.8 GB" from used % and available bytes (total = available / free share). */
function memLine(usedPct?: number, availBytes?: number): string | undefined {
  if (usedPct === undefined || availBytes === undefined || usedPct >= 100) return undefined;
  const total = availBytes / (1 - usedPct / 100);
  const gb = (b: number) => (b / 1024 ** 3).toFixed(1);
  return `${gb(total - availBytes)} / ${gb(total)} GB`;
}
