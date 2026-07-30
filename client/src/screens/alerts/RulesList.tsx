// Alert Rules (§13.3): grouped by Series, enable toggles. Reads real rules from
// the Agent when connected to a real Pi; the demo uses the seeded store.
import React, { useEffect, useState } from 'react';
import { Switch, View } from 'react-native';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { useTheme } from '../../theme';
import { useStore } from '../../store/useStore';
import { Screen, Card, ListRow, Eyebrow } from '../../components/Shared';
import { EmptyState } from '../../components/States';
import { ActionButton } from '../../components/ActionButton';
import { SERIES } from '../../sim/metrics';
import { fetchRules, putRule } from '../../net/localTransport';
import { AlertRule } from '../../types';
import { fmtValue } from '../../lib/format';

export function RulesList() {
  const { c } = useTheme();
  const nav = useNavigation<any>();
  const isFocused = useIsFocused();
  const agentId = useStore((s) => s.currentAgentId);
  const endpoint = useStore((s) => (agentId ? s.endpoints[agentId] : undefined));
  const storeRules = useStore((s) => s.rules);
  const upsertRule = useStore((s) => s.upsertRule);

  const [realRules, setRealRules] = useState<AlertRule[]>([]);
  const refresh = () => {
    if (endpoint) fetchRules(endpoint).then((rs) => setRealRules(rs as AlertRule[]));
  };
  useEffect(() => {
    if (endpoint && isFocused) refresh();
  }, [endpoint?.ip, isFocused]);

  const rules = endpoint ? realRules : storeRules;
  const keys = [...new Set(rules.map((r) => r.seriesKey))];

  const toggle = async (r: AlertRule, v: boolean) => {
    const next = { ...r, enabled: v };
    if (endpoint) {
      setRealRules((rs) => rs.map((x) => (x.id === r.id ? next : x)));
      await putRule(endpoint, next);
    } else {
      upsertRule(next);
    }
  };

  return (
    <Screen>
      {rules.length === 0 ? (
        <EmptyState
          icon="options-outline"
          title="No alert rules yet"
          body="A rule watches one metric and tells you when it crosses a line you set."
          actionLabel="Add a rule"
          onAction={() => nav.navigate('RuleEditor', {})}
        />
      ) : (
        <>
          {keys.map((key) => (
            <View key={key}>
              <Eyebrow>{(SERIES[key]?.title ?? key).toUpperCase()}</Eyebrow>
              <Card>
                {rules
                  .filter((r) => r.seriesKey === key)
                  .map((r, i, arr) => {
                    const f = fmtValue(r.seriesKey, r.threshold);
                    return (
                      <ListRow
                        key={r.id}
                        title={`${r.op === 'above' ? 'Above' : 'Below'} ${f.value} ${f.unit} for ${r.dwellS} s`}
                        value={r.severity}
                        onPress={() => nav.navigate('RuleEditor', endpoint ? { rule: r } : { ruleId: r.id })}
                        right={
                          <Switch
                            value={r.enabled}
                            onValueChange={(v) => toggle(r, v)}
                            trackColor={{ true: c.accent.base }}
                            style={{ transform: [{ scale: 0.8 }] }}
                          />
                        }
                        last={i === arr.length - 1}
                      />
                    );
                  })}
              </Card>
            </View>
          ))}
          <ActionButton
            label="Add a rule"
            variant="secondary"
            onPress={() => nav.navigate('RuleEditor', {})}
            style={{ marginTop: 24 }}
          />
        </>
      )}
    </Screen>
  );
}
