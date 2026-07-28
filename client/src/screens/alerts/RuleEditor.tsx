// Rule editor (§13.3). The backtest preview is the feature: every change
// re-computes "this would have fired N times in the last 24 hours" against
// history — the difference between a rule you guess at and one you can see.
import React, { useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTheme, withAlpha } from '../../theme';
import { useStore } from '../../store/useStore';
import { Screen, Card } from '../../components/Shared';
import { MetricChart } from '../../components/MetricChart';
import { ActionButton } from '../../components/ActionButton';
import { AlertRule, SeriesKey, Severity } from '../../types';
import { sampleSeries, SERIES } from '../../sim/metrics';
import { backtestSpans } from '../../sim/backtest';
import { fmtClock, fmtDuration, fmtValue } from '../../lib/format';

const EDITABLE: SeriesKey[] = ['cpu.temp_c', 'cpu.util_pct', 'mem.used_pct', 'disk.used_pct', 'load.1m'];

export function RuleEditor() {
  const { c, type, radius } = useTheme();
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const existing = useStore((s) => s.rules.find((r) => r.id === route.params?.ruleId));
  const upsertRule = useStore((s) => s.upsertRule);
  const deleteRule = useStore((s) => s.deleteRule);
  const connection = useStore((s) => s.connection);

  const [seriesKey, setSeriesKey] = useState<SeriesKey>(existing?.seriesKey ?? route.params?.seriesKey ?? 'cpu.temp_c');
  const [op, setOp] = useState<'above' | 'below'>(existing?.op ?? 'above');
  const [threshold, setThreshold] = useState(existing ? String(existing.threshold) : '80');
  const [dwellS, setDwellS] = useState(existing ? String(existing.dwellS) : '90');
  const [severity, setSeverity] = useState<Severity>(existing?.severity ?? 'warning');

  const meta = SERIES[seriesKey];
  const th = parseFloat(threshold);
  const dw = parseInt(dwellS, 10);
  const thresholdInvalid = Number.isNaN(th);
  const dwellInvalid = Number.isNaN(dw) || dw < 5;

  const samples = useMemo(() => {
    const to = Date.now();
    return sampleSeries(seriesKey, to - 24 * 3_600_000, to, 240);
  }, [seriesKey]);

  // Backtest: spans where the predicate held for at least the dwell.
  const backtest = useMemo(() => {
    if (thresholdInvalid || dwellInvalid) return null;
    return { spans: backtestSpans(samples, { op, threshold: th, dwellS: dw }, Date.now()) };
  }, [samples, th, dw, op, thresholdInvalid, dwellInvalid]);

  const save = () => {
    const rule: AlertRule = {
      id: existing?.id ?? `rule-${Date.now()}`,
      seriesKey,
      op,
      threshold: th,
      dwellS: dw,
      severity,
      enabled: existing?.enabled ?? true,
      notify: existing?.notify ?? true,
    };
    upsertRule(rule);
    nav.goBack();
  };

  const segBtn = (selected: boolean, tone?: string) => ({
    flex: 1,
    height: 34,
    borderRadius: radius.s - 2,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: selected ? withAlpha(tone ?? c.accent.base, 0.14) : 'transparent',
  });

  const offline = connection.kind !== 'connected';
  const last = backtest?.spans[backtest.spans.length - 1];

  return (
    <Screen>
      {/* Metric picker */}
      <Text style={[type.micro, { color: c.text.tertiary, marginBottom: 8 }]}>METRIC</Text>
      <Card>
        {EDITABLE.map((key, i) => (
          <Pressable
            key={key}
            onPress={() => setSeriesKey(key)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: 16,
              paddingVertical: 10,
              backgroundColor: key === seriesKey ? withAlpha(c.accent.base, c.accent.washAlpha) : 'transparent',
              borderBottomWidth: i === EDITABLE.length - 1 ? 0 : 1,
              borderBottomColor: c.border.hairline,
            }}
          >
            <Text style={[type.body, { color: c.text.primary, flex: 1 }]}>{SERIES[key].title}</Text>
            <Text style={[type.monoBody, { color: c.text.tertiary, fontSize: 12 }]}>{key}</Text>
          </Pressable>
        ))}
      </Card>

      {/* Condition */}
      <Text style={[type.micro, { color: c.text.tertiary, marginTop: 20, marginBottom: 8 }]}>CONDITION</Text>
      <Card style={{ padding: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={[type.body, { color: c.text.secondary }]}>is</Text>
          <Pressable
            onPress={() => setOp(op === 'above' ? 'below' : 'above')}
            style={{
              paddingHorizontal: 12,
              height: 36,
              borderRadius: radius.s,
              borderWidth: 1,
              borderColor: c.border.strong,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={[type.body, { color: c.accent.base }]}>{op} ⌄</Text>
          </Pressable>
          <TextInput
            value={threshold}
            onChangeText={setThreshold}
            keyboardType="decimal-pad"
            style={[
              type.metricM,
              {
                color: c.text.primary,
                borderWidth: 1,
                borderColor: thresholdInvalid ? c.status.warning : c.border.strong,
                borderRadius: radius.s,
                paddingHorizontal: 12,
                height: 36,
                minWidth: 76,
                textAlign: 'center',
              },
            ]}
          />
          <Text style={[type.body, { color: c.text.secondary }]}>{meta.unit}</Text>
        </View>
        {thresholdInvalid && (
          <Text style={[type.footnote, { color: c.status.warning, marginTop: 6 }]}>Enter a number</Text>
        )}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 }}>
          <Text style={[type.body, { color: c.text.secondary }]}>for</Text>
          <TextInput
            value={dwellS}
            onChangeText={setDwellS}
            keyboardType="number-pad"
            style={[
              type.metricM,
              {
                color: c.text.primary,
                borderWidth: 1,
                borderColor: dwellInvalid ? c.status.warning : c.border.strong,
                borderRadius: radius.s,
                paddingHorizontal: 12,
                height: 36,
                minWidth: 76,
                textAlign: 'center',
              },
            ]}
          />
          <Text style={[type.body, { color: c.text.secondary }]}>seconds</Text>
        </View>
        {dwellInvalid && (
          <Text style={[type.footnote, { color: c.status.warning, marginTop: 6 }]}>
            Hold time must be at least 5 seconds
          </Text>
        )}
      </Card>

      {/* Severity */}
      <Text style={[type.micro, { color: c.text.tertiary, marginTop: 20, marginBottom: 8 }]}>SEVERITY</Text>
      <View
        style={{
          flexDirection: 'row',
          backgroundColor: c.surface.raised,
          borderRadius: radius.s,
          borderWidth: 1,
          borderColor: c.border.subtle,
          padding: 2,
        }}
      >
        {(['info', 'warning', 'critical'] as const).map((sev) => (
          <Pressable key={sev} onPress={() => setSeverity(sev)} style={segBtn(severity === sev, c.status[sev])}>
            <Text
              style={[
                type.subhead,
                { color: severity === sev ? c.status[sev] : c.text.secondary, fontWeight: '600', textTransform: 'capitalize' },
              ]}
            >
              {sev}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Backtest preview — the editor's centrepiece */}
      <View style={{ marginTop: 20 }}>
        <MetricChart
          title={`${meta.label} · LAST 24H`}
          samples={samples}
          unit={meta.unit}
          formatValue={(x) => fmtValue(seriesKey, x).value}
          thresholds={thresholdInvalid ? [] : [{ value: th, color: c.status[severity] }]}
          height={140}
          scrubEnabled={false}
        />
      </View>
      {backtest && (
        <Text style={[type.callout, { color: c.status.info, marginTop: 10 }]}>
          {backtest.spans.length === 0
            ? 'This would not have fired in the last 24 hours.'
            : `This would have fired ${backtest.spans.length} time${backtest.spans.length === 1 ? '' : 's'} in the last 24 hours — most recently at ${fmtClock(last!.from)}, for ${fmtDuration((last!.to - last!.from) / 1000)}.`}
        </Text>
      )}

      <ActionButton
        label="Save"
        onPress={save}
        disabled={thresholdInvalid || dwellInvalid || offline}
        disabledReason={
          offline ? 'Rules are stored on the Pi, which is offline.' : 'Fix the highlighted fields first.'
        }
        style={{ marginTop: 24 }}
      />
      {existing && (
        <ActionButton
          label="Delete rule"
          variant="destructive"
          onPress={() => {
            deleteRule(existing.id);
            nav.goBack();
          }}
          style={{ marginTop: 10 }}
        />
      )}
    </Screen>
  );
}
