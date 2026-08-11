// Alert detail (§13.2): fact table, the data behind the alert (±30 min around
// the fire time, fetched from the Agent's real history), known causes only for
// system metrics, ack/snooze.
import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTheme } from '../../theme';
import { useStore } from '../../store/useStore';
import { Screen, Card } from '../../components/Shared';
import { MetricChart } from '../../components/MetricChart';
import { ActionButton } from '../../components/ActionButton';
import { Ionicons } from '@expo/vector-icons';
import { SERIES } from '../../lib/series';
import { fetchSeries } from '../../net/localTransport';
import { Sample } from '../../types';
import { fmtClock, fmtDuration, fmtValue } from '../../lib/format';

const CAUSES: Partial<Record<string, string>> = {
  'cpu.temp_c':
    'Sustained CPU load, a blocked fan, or an enclosure with no airflow. The Pi will slow itself down at 80 °C and more at 85 °C to protect itself.',
  'disk.used_pct':
    'Logs, package caches, or media that keeps growing. Old journal files and apt caches are the usual first place to look.',
};

export function AlertDetail() {
  const { c, type } = useTheme();
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const alert = useStore((s) => s.alerts.find((a) => a.id === route.params?.alertId));
  const rule = useStore((s) => s.rules.find((r) => r.id === alert?.ruleId));
  const agent = useStore((s) => s.agents.find((a) => a.id === s.currentAgentId));
  const ackAlert = useStore((s) => s.ackAlert);
  const snoozeAlert = useStore((s) => s.snoozeAlert);
  const endpoint = useStore((s) => (s.currentAgentId ? s.endpoints[s.currentAgentId] : undefined));

  // Real history around the fire time; empty (an honest gap) if unreachable.
  const [samples, setSamples] = useState<Sample[]>([]);
  useEffect(() => {
    let alive = true;
    if (alert && endpoint) {
      fetchSeries(endpoint, alert.seriesKey, alert.firedAt - 30 * 60_000, alert.firedAt + 30 * 60_000).then(
        (s) => alive && setSamples(s),
      );
    } else {
      setSamples([]);
    }
    return () => {
      alive = false;
    };
  }, [alert?.id, endpoint?.ip, endpoint?.port]);

  if (!alert) return <Screen><Text /></Screen>;

  const meta = SERIES[alert.seriesKey];
  const tone = alert.resolvedAt ? c.status.ok : c.status[alert.severity];
  const peak = fmtValue(alert.seriesKey, alert.peak.v);
  const cause = CAUSES[alert.seriesKey];
  const firingForS = ((alert.resolvedAt ?? Date.now()) - alert.firedAt) / 1000;

  const facts: [string, string][] = [
    ['Started', fmtClock(alert.firedAt)],
    [alert.resolvedAt ? 'Lasted' : 'Still firing', fmtDuration(firingForS)],
    ['Rule', rule ? `${rule.op} ${fmtValue(alert.seriesKey, rule.threshold).value} ${meta.unit} for ${rule.dwellS} s` : 'deleted'],
    ['Peak', `${peak.value} ${peak.unit} at ${fmtClock(alert.peak.t)}`],
  ];

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Ionicons name={alert.resolvedAt ? 'checkmark-circle' : 'warning'} size={16} color={tone} />
        <Text style={[type.micro, { color: tone, marginLeft: 6 }]}>
          {alert.resolvedAt ? 'RESOLVED' : alert.severity.toUpperCase()}
        </Text>
      </View>
      <Text style={[type.title1, { color: c.text.primary, marginTop: 8 }]}>{alert.title}</Text>
      <Text style={[type.subhead, { color: c.text.secondary, marginTop: 4 }]}>{agent?.name}</Text>

      <Card style={{ marginTop: 20, padding: 16, gap: 10 }}>
        {facts.map(([k, v]) => (
          <View key={k} style={{ flexDirection: 'row' }}>
            <Text style={[type.micro, { color: c.text.tertiary, width: 100, paddingTop: 4 }]}>{k.toUpperCase()}</Text>
            <Text style={[type.metricM, { color: c.text.primary }]}>{v}</Text>
          </View>
        ))}
      </Card>

      <View style={{ marginTop: 16 }}>
        <MetricChart
          title={meta.label}
          samples={samples}
          unit={meta.unit}
          formatValue={(x) => fmtValue(alert.seriesKey, x).value}
          thresholds={rule ? [{ value: rule.threshold, color: tone }] : []}
          height={140}
        />
      </View>

      {cause && (
        <>
          <Text style={[type.micro, { color: c.text.tertiary, marginTop: 24, marginBottom: 8 }]}>
            WHAT USUALLY CAUSES THIS
          </Text>
          <Text style={[type.subhead, { color: c.text.secondary }]}>{cause}</Text>
        </>
      )}

      {!alert.resolvedAt && (
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 24 }}>
          <ActionButton
            label={alert.acknowledgedAt ? 'Acknowledged' : 'Acknowledge'}
            variant="secondary"
            disabled={alert.acknowledgedAt != null}
            onPress={() => ackAlert(alert.id)}
            style={{ flex: 1 }}
          />
          <ActionButton
            label="Snooze 1 hour"
            variant="secondary"
            onPress={() => snoozeAlert(alert.id, Date.now() + 3_600_000)}
            style={{ flex: 1 }}
          />
        </View>
      )}
      <ActionButton
        label="See the data ›"
        variant="tertiary"
        onPress={() => nav.navigate('MonitorTab', { screen: 'MetricDetail', params: { seriesKey: alert.seriesKey } })}
        style={{ marginTop: 8 }}
      />
      {rule && (
        <ActionButton
          label="Edit this rule ›"
          variant="tertiary"
          onPress={() => nav.navigate('RuleEditor', { ruleId: rule.id })}
        />
      )}
    </Screen>
  );
}
