// Actions (§12): allow-listed operations, the literal command always shown.
// Destructive actions take the four-gate pattern (§17.1): destructive trigger →
// consequence sheet → slide-to-confirm → biometric.
import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { useTheme } from '../../theme';
import { useStore } from '../../store/useStore';
import { Screen, Card, ListRow, Eyebrow } from '../../components/Shared';
import { ConnectionBanner } from '../../components/ConnectionBanner';
import { DestructiveConfirm } from '../../components/DestructiveConfirm';
import { EmptyState } from '../../components/States';
import { runAction } from '../../sim/tunnel';
import { fetchActions, runActionRemote } from '../../net/localTransport';
import { AgentAction } from '../../types';
import { fmtClock, fmtDuration } from '../../lib/format';

export function ActionsScreen() {
  const { c, type } = useTheme();
  const nav = useNavigation<any>();
  const isFocused = useIsFocused();
  const agentId = useStore((s) => s.currentAgentId);
  const agent = useStore((s) => s.agents.find((a) => a.id === agentId));
  const endpoint = useStore((s) => (agentId ? s.endpoints[agentId] : undefined));
  const real = !!endpoint;
  const storeActions = useStore((s) => s.actions);
  const runningId = useStore((s) => s.runningActionId);
  const connection = useStore((s) => s.connection);
  const [confirming, setConfirming] = useState<AgentAction | null>(null);

  // Real Agent: fetch the allow-list from the Pi; else use the seeded demo list.
  const [realActions, setRealActions] = useState<AgentAction[]>([]);
  const [realRunning, setRealRunning] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<Record<string, { at: number; exitCode: number }>>({});
  useEffect(() => {
    if (real && endpoint && isFocused) {
      fetchActions(endpoint).then((list) => setRealActions(list as AgentAction[]));
    }
  }, [real, endpoint?.ip, isFocused]);

  const actions = real ? realActions : storeActions;
  const connected = connection.kind === 'connected';
  const categories = [...new Set(actions.map((a) => a.category))];

  const trigger = (action: AgentAction) => {
    if (action.destructive) setConfirming(action);
    else void execute(action);
  };

  const execute = async (action: AgentAction) => {
    if (real && endpoint) {
      setRealRunning(action.id);
      const res = await runActionRemote(endpoint, action.id);
      setRealRunning(null);
      if (res) setLastResult((m) => ({ ...m, [action.id]: { at: Date.now(), exitCode: res.exitCode } }));
      if (action.dropsTunnel) nav.navigate('RebootWatch');
    } else {
      runAction(action.id);
      if (action.dropsTunnel) nav.navigate('RebootWatch');
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
    await execute(action);
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.surface.canvas }}>
      <ConnectionBanner onPress={() => nav.navigate('Diagnostics')} />
      <Screen>
        <Text style={[type.footnote, { color: c.text.secondary }]}>
          These are the only operations this Pi will accept. The list is set on the Pi.
        </Text>

        {actions.length === 0 && (
          <EmptyState
            icon="flash-outline"
            title="No actions are configured"
            body="Actions are set on the Pi itself, in the Agent's config file."
          />
        )}

        {categories.map((cat) => {
          const items = actions.filter((a) => a.category === cat);
          const destructiveGroup = items.some((a) => a.destructive);
          return (
            <View key={cat}>
              <Eyebrow warning={destructiveGroup}>{cat.toUpperCase()}</Eyebrow>
              <Card destructive={destructiveGroup}>
                {items.map((a, i) => {
                  const curRunning = real ? realRunning : runningId;
                  const running = curRunning === a.id;
                  const lr = real ? lastResult[a.id] : a.lastRun ? { at: a.lastRun.at, exitCode: a.lastRun.exitCode } : undefined;
                  const sub = running
                    ? `${a.name}…`
                    : lr
                      ? `${a.command} · last run ${fmtClock(lr.at)} · ${lr.exitCode === 0 ? 'ok' : `exit ${lr.exitCode}`}`
                      : `${a.command} · ~${fmtDuration(a.expectedDurationS)}${a.destructive ? ' · confirmation' : ''}`;
                  return (
                    <ListRow
                      key={a.id}
                      title={a.name}
                      subtitle={sub}
                      mono
                      destructive={a.destructive}
                      chevron={!running}
                      disabled={!connected || (curRunning != null && !running)}
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
