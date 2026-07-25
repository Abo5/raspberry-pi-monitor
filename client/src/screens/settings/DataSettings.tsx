// Settings → Data & retention (§14). Pi-side settings are disabled with a
// reason when the Tunnel is down — never silently dead.
import React from 'react';
import { Alert as RNAlert, Text } from 'react-native';
import { useTheme } from '../../theme';
import { useStore } from '../../store/useStore';
import { Screen, Card, ListRow, Eyebrow } from '../../components/Shared';

export function DataSettings() {
  const { c, type } = useTheme();
  const settings = useStore((s) => s.settings);
  const setSettings = useStore((s) => s.setSettings);
  const connection = useStore((s) => s.connection);
  const agent = useStore((s) => s.agents.find((a) => a.id === s.currentAgentId));
  const setStore = useStore((s) => s.set);

  const connected = connection.kind === 'connected';

  return (
    <Screen>
      <Eyebrow>ON THE PI</Eyebrow>
      <Card>
        <ListRow
          title="Telemetry interval"
          value={connected ? `${settings.telemetryIntervalS}s` : undefined}
          disabled={!connected}
          onPress={() => {
            const order = [1, 5, 15, 60];
            const next = order[(order.indexOf(settings.telemetryIntervalS) + 1) % order.length];
            setSettings({ telemetryIntervalS: next });
          }}
        />
        <ListRow title="Retention" value="90 d raw · 2 y rollups" disabled={!connected} last />
      </Card>
      {!connected && (
        <Text style={[type.footnote, { color: c.text.tertiary, marginTop: 8 }]}>
          These are stored on {agent?.name ?? 'the Pi'}, which is offline.
        </Text>
      )}

      <Eyebrow>ON THIS PHONE</Eyebrow>
      <Card>
        <ListRow
          title="Clear cached history"
          subtitle="Safe — the real history lives on the Pi and will download again."
          onPress={() =>
            RNAlert.alert('Clear cached history?', 'The real history lives on the Pi.', [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Clear',
                style: 'destructive',
                onPress: () => setStore({ alerts: [], events: [], rttHistory: [] }),
              },
            ])
          }
          last
        />
      </Card>
    </Screen>
  );
}
