// Metric detail (§8): one Series with history, thresholds, stats and rules.
// The stats strip states its own resolution; one hero figure per screen.
import React, { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTheme } from '../../theme';
import { useStore } from '../../store/useStore';
import { ConnectionBanner } from '../../components/ConnectionBanner';
import { TimeRangeChips } from '../../components/TimeRangeChips';
import { MetricChart } from '../../components/MetricChart';
import { ListRow, Card } from '../../components/Shared';
import { RANGE_MS, SeriesKey, TimeRange } from '../../types';
import { rollupNote, sampleSeries, SERIES } from '../../sim/metrics';
import { fmtValue } from '../../lib/format';
import { alertTitle } from '../../sim/tunnel';

export function MetricDetail() {
  const { c, type } = useTheme();
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const seriesKey = (route.params?.seriesKey ?? 'cpu.temp_c') as SeriesKey;
  const meta = SERIES[seriesKey];

  const snapshot = useStore((s) => s.snapshot);
  const rules = useStore((s) => s.rules.filter((r) => r.seriesKey === seriesKey));
  const [range, setRange] = useState<TimeRange>('6h');

  const tick = RANGE_MS[range] <= RANGE_MS['1h'] ? snapshot?.receivedAt : 0;
  const samples = useMemo(() => {
    const to = Date.now();
    return sampleSeries(seriesKey, to - RANGE_MS[range], to, 120);
  }, [seriesKey, range, tick]);

  const stats = useMemo(() => {
    const vs = samples.map((s) => s.v).sort((a, b) => a - b);
    const avg = vs.reduce((a, b) => a + b, 0) / vs.length;
    return {
      min: vs[0],
      avg,
      max: vs[vs.length - 1],
      p95: vs[Math.floor(vs.length * 0.95)],
    };
  }, [samples]);

  const current = snapshot?.values[seriesKey];
  const f = current != null ? fmtValue(seriesKey, current) : null;

  const thresholds = [
    ...(meta.hardThresholds
      ? [
          { value: meta.hardThresholds.soft, color: c.status.warning },
          { value: meta.hardThresholds.hard, color: c.status.critical },
        ]
      : []),
    ...rules
      .filter((r) => !meta.hardThresholds || (r.threshold !== meta.hardThresholds.soft && r.threshold !== meta.hardThresholds.hard))
      .map((r) => ({ value: r.threshold, color: r.severity === 'critical' ? c.status.critical : c.status.warning })),
  ];

  return (
    <View style={{ flex: 1, backgroundColor: c.surface.canvas }}>
      <ConnectionBanner onPress={() => nav.navigate('Diagnostics')} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        <TimeRangeChips value={range} onChange={setRange} />
        <Text style={[type.caption, { color: c.text.tertiary, marginTop: 6 }]}>
          {rollupNote(RANGE_MS[range])}
        </Text>

        {/* Hero figure — exactly one per screen */}
        <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 16 }}>
          <Text style={[type.hero, { color: c.text.primary }]}>{f?.value ?? '—'}</Text>
          <Text style={[type.title3, { color: c.text.tertiary, marginLeft: 4 }]}>{f?.unit}</Text>
        </View>
        <Text style={[type.caption, { color: c.text.secondary, marginBottom: 16 }]}>now</Text>

        <MetricChart
          title={meta.label}
          samples={samples}
          unit={meta.unit}
          formatValue={(x) => fmtValue(seriesKey, x).value}
          thresholds={thresholds}
        />

        {/* Stats strip */}
        <View style={{ flexDirection: 'row', marginTop: 20, justifyContent: 'space-between', paddingHorizontal: 4 }}>
          {(['min', 'avg', 'max', 'p95'] as const).map((k) => (
            <View key={k} style={{ alignItems: 'center' }}>
              <Text style={[type.micro, { color: c.text.tertiary }]}>{k.toUpperCase()}</Text>
              <Text style={[type.metricM, { color: c.text.primary, marginTop: 2 }]}>
                {fmtValue(seriesKey, stats[k]).value}
              </Text>
            </View>
          ))}
        </View>

        {/* Rules on this metric */}
        <Text style={[type.micro, { color: c.text.tertiary, marginTop: 28, marginBottom: 8 }]}>
          ALERT RULES ON THIS METRIC
        </Text>
        <Card>
          {rules.map((r, i) => (
            <ListRow
              key={r.id}
              title={alertTitle(r)}
              subtitle={`for ${r.dwellS} s`}
              value={r.severity}
              chevron
              last={i === rules.length - 1 && false}
              onPress={() => nav.navigate('AlertsTab', { screen: 'RuleEditor', params: { ruleId: r.id } })}
            />
          ))}
          <ListRow
            title="Add a rule"
            onPress={() => nav.navigate('AlertsTab', { screen: 'RuleEditor', params: { seriesKey } })}
            icon="add-outline"
            last
          />
        </Card>
      </ScrollView>
    </View>
  );
}
