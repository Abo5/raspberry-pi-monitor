// Actions (§12): allow-listed operations, the literal command always shown.
// Destructive actions take the four-gate pattern (§17.1): destructive trigger →
// consequence sheet → slide-to-confirm → biometric.
import React, { useState } from 'react';
import { Text, View } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../theme';
import { useStore } from '../../store/useStore';
import { Screen, Card, ListRow, Eyebrow } from '../../components/Shared';
import { ConnectionBanner } from '../../components/ConnectionBanner';
import { DestructiveConfirm } from '../../components/DestructiveConfirm';
import { runAction } from '../../sim/tunnel';
import { AgentAction } from '../../types';
import { fmtClock, fmtDuration } from '../../lib/format';

export function ActionsScreen() {
  const { c, type } = useTheme();
  const nav = useNavigation<any>();
  const agent = useStore((s) => s.agents.find((a) => a.id === s.currentAgentId));
  const actions = useStore((s) => s.actions);
  const runningId = useStore((s) => s.runningActionId);
  const connection = useStore((s) => s.connection);
  const [confirming, setConfirming] = useState<AgentAction | null>(null);

  const connected = connection.kind === 'connected';
  const categories = [...new Set(actions.map((a) => a.category))];

  const trigger = (action: AgentAction) => {
    if (action.destructive) {
      setConfirming(action);
    } else {
      runAction(action.id);
    }
  };

  const confirmed = async () => {
    const action = confirming;
    setConfirming(null);
    if (!action) return;
    // Biometric after the gesture, immediately before the request goes out (§17.1 gate 4).
    if (await LocalAuthentication.hasHardwareAsync()) {
      const res = await LocalAuthentication.authenticateAsync({
        promptMessage: `Confirm: ${action.name} on ${agent?.name}`,
      });
      if (!res.success) return;
    }
    runAction(action.id);
    if (action.dropsTunnel) nav.navigate('RebootWatch');
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.surface.canvas }}>
      <ConnectionBanner onPress={() => nav.navigate('Diagnostics')} />
      <Screen>
        <Text style={[type.footnote, { color: c.text.secondary }]}>
          These are the only operations this Pi will accept. The list is set on the Pi.
        </Text>

        {categories.map((cat) => {
          const items = actions.filter((a) => a.category === cat);
          const destructiveGroup = items.some((a) => a.destructive);
          return (
            <View key={cat}>
              <Eyebrow warning={destructiveGroup}>{cat.toUpperCase()}</Eyebrow>
              <Card destructive={destructiveGroup}>
                {items.map((a, i) => {
                  const running = runningId === a.id;
                  const sub = running
                    ? `${a.name}…`
                    : a.lastRun
                      ? `${a.command} · last run ${fmtClock(a.lastRun.at)} · ${a.lastRun.exitCode === 0 ? 'ok' : `exit ${a.lastRun.exitCode}`}`
                      : `${a.command} · ~${fmtDuration(a.expectedDurationS)}${a.destructive ? ' · confirmation' : ''}`;
                  return (
                    <ListRow
                      key={a.id}
                      title={a.name}
                      subtitle={sub}
                      mono
                      destructive={a.destructive}
                      chevron={!running}
                      disabled={!connected || (runningId != null && !running)}
                      onPress={() => trigger(a)}
                      last={i === items.length - 1}
                    />
                  );
                })}
              </Card>
            </View>
          );
        })}
        {!connected && (
          <Text style={[type.footnote, { color: c.text.tertiary, marginTop: 12 }]}>
            {agent?.name} is offline
          </Text>
        )}
      </Screen>

      <DestructiveConfirm
        visible={confirming != null}
        title={`${confirming?.name} ${agent?.name ?? ''}`}
        consequence={confirming?.confirmText ?? ''}
        facts={[
          ['Command', confirming?.command ?? ''],
          ['Downtime', `~${fmtDuration(confirming?.expectedDurationS ?? 0)}`],
          ['Affects', useStore.getState().shellSessionStartedAt ? '1 shell session' : 'no open sessions'],
        ]}
        slideLabel={`slide to ${confirming?.name.toLowerCase() ?? 'confirm'}`}
        onConfirm={confirmed}
        onCancel={() => setConfirming(null)}
      />
    </View>
  );
}
