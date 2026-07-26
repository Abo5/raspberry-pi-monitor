// Dashboard (§7) — the hero screen. Vertical order is deliberate:
// connection → the four numbers that matter → what I can do → what is wrong → why.
import React, { useMemo, useState } from 'react';
import { RefreshControl, ScrollView, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
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
import { rollupNote, sampleSeries } from '../../sim/metrics';
import { fmtBps, fmtPct, fmtTemp } from '../../lib/format';

const QUICK: { icon: keyof typeof Ionicons.glyphMap; label: string; target: string }[] = [
  { icon: 'desktop-outline', label: 'Desktop', target: 'Desktop' },
  { icon: 'terminal-outline', label: 'Shell', target: 'Shell' },
  { icon: 'refresh-outline', label: 'Restart', target: 'Actions' },
  { icon: 'flash-outline', label: 'Actions', target: 'Actions' },
];

export function DashboardScreen() {
  const { c, type } = useTheme();
  const nav = useNavigation<any>();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const tileW = (width - 32 - 12) / 2;

  const agent = useStore((s) => s.agents.find((a) => a.id === s.currentAgentId));
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
  const series = useMemo(() => {
    const to = Date.now();
    const from = to - RANGE_MS[range];
    const keys: SeriesKey[] = ['cpu.util_pct', 'cpu.temp_c', 'mem.used_pct', 'net.rx_bps', 'net.tx_bps'];
    return Object.fromEntries(keys.map((k) => [k, sampleSeries(k, from, to, 60)])) as Record<SeriesKey, ReturnType<typeof sampleSeries>>;
  }, [range, tick]);

  const v = snapshot?.values;
  const active = alerts.filter((a) => a.resolvedAt == null);
  const rx = v ? fmtBps(v['net.rx_bps'] ?? 0) : null;
  const tx = v ? fmtBps(v['net.tx_bps'] ?? 0) : null;
  const temp = v?.['cpu.temp_c'] ?? 0;
  const thermalColor =
    temp >= 80 ? c.thermal.steps[4] : temp >= 74 ? c.thermal.steps[3] : temp >= 67 ? c.thermal.steps[2] : temp >= 60 ? c.thermal.steps[1] : temp >= 50 ? c.thermal.steps[0] : undefined;

  return (
    <View style={{ flex: 1, backgroundColor: c.surface.canvas, paddingTop: insets.top }}>
      {/* Header: AgentChip title + menu */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10 }}>
        <TouchableOpacity
          style={{ flexDirection: 'row', alignItems: 'center' }}
          onPress={() => setShowSwitcher(true)}
          accessibilityRole="button"
        >
          <Text style={[type.title2, { color: c.text.primary }]}>{agent?.name ?? 'Dashboard'}</Text>
          <Ionicons name="chevron-down" size={16} color={c.text.tertiary} style={{ marginLeft: 4 }} />
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
        <TouchableOpacity onPress={() => nav.navigate('Diagnostics')} accessibilityRole="button">
          <Ionicons name="ellipsis-horizontal" size={20} color={c.text.secondary} />
        </TouchableOpacity>
      </View>

      <ConnectionBanner onPress={() => nav.navigate('Diagnostics')} />

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
              secondary={`${(((v['mem.used_pct'] ?? 0) / 100) * 8).toFixed(1)} / 8.0 GB`}
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
              hitSlop={8}
            >
              <Ionicons name="close" size={16} color={c.text.tertiary} />
            </TouchableOpacity>
          </View>
        )}

        {/* Quick actions */}
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
        {!connected && (
          <Text style={[type.footnote, { color: c.text.tertiary, marginTop: 6 }]}>
            {offline ? `${agent?.name} is offline` : 'Waiting for a connection'}
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
                  agentName={agent?.name ?? ''}
                  onPress={() => nav.navigate('AlertsTab', { screen: 'AlertDetail', params: { alertId: a.id } })}
                />
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
