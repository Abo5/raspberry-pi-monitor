// Security log: LogRow-styled listing of connection/security events (§7.7).
// WARN and above get a 3pt leading severity stripe so level is not colour-only.
import React from 'react';
import { Text, View } from 'react-native';
import { useTheme } from '../../theme';
import { useStore } from '../../store/useStore';
import { Screen } from '../../components/Shared';
import { EmptyState } from '../../components/States';
import { fmtClock } from '../../lib/format';

export function SecurityLog() {
  const { c, type, radius } = useTheme();
  const events = useStore((s) => s.events);

  if (events.length === 0) {
    return (
      <Screen>
        <EmptyState icon="document-text-outline" title="No log lines in this range" body="The Agent has nothing recorded for this window." />
      </Screen>
    );
  }

  return (
    <Screen>
      <View
        style={{
          backgroundColor: c.surface.sunken,
          borderRadius: radius.s,
          paddingVertical: 6,
        }}
      >
        {events.map((e, i) => {
          const tone = e.level === 'WARN' ? c.status.warning : e.level === 'ERROR' ? c.status.critical : c.text.secondary;
          const striped = e.level !== 'INFO';
          return (
            <View key={i} style={{ flexDirection: 'row', minHeight: 28, alignItems: 'center' }}>
              <View style={{ width: 3, alignSelf: 'stretch', backgroundColor: striped ? tone : 'transparent' }} />
              <Text style={[type.monoBody, { color: c.text.tertiary, width: 78, marginLeft: 9, fontSize: 12 }]}>
                {fmtClock(e.t)}
              </Text>
              <Text style={[type.micro, { color: tone, width: 52 }]}>{e.level}</Text>
              <Text style={[type.monoBody, { color: c.text.primary, flex: 1, fontSize: 12 }]} numberOfLines={1}>
                {e.message}
              </Text>
            </View>
          );
        })}
      </View>
    </Screen>
  );
}
