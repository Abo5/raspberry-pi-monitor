// Alert Rules (§13.3): grouped by Series, enable toggles.
import React from 'react';
import { Switch, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../theme';
import { useStore } from '../../store/useStore';
import { Screen, Card, ListRow, Eyebrow } from '../../components/Shared';
import { EmptyState } from '../../components/States';
import { ActionButton } from '../../components/ActionButton';
import { SERIES } from '../../sim/metrics';
import { fmtValue } from '../../lib/format';

export function RulesList() {
  const { c } = useTheme();
  const nav = useNavigation<any>();
  const rules = useStore((s) => s.rules);
  const upsertRule = useStore((s) => s.upsertRule);

  const keys = [...new Set(rules.map((r) => r.seriesKey))];

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
              <Eyebrow>{SERIES[key].title.toUpperCase()}</Eyebrow>
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
                        onPress={() => nav.navigate('RuleEditor', { ruleId: r.id })}
                        right={
                          <Switch
                            value={r.enabled}
                            onValueChange={(v) => upsertRule({ ...r, enabled: v })}
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
