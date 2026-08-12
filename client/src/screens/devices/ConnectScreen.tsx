// "Connecting to" full-screen, in the Windows App style: dimmed bloom backdrop,
// centred progress, X to cancel. On success it hands off to the remote desktop;
// on failure (unreachable Pi / rejected key / timeout) it shows a clear error
// with Retry and Back so the user is never stuck on an endless spinner.
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View, useWindowDimensions } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { useStore } from '../../store/useStore';
import { WaveBackground } from '../../components/WaveBackground';
import { ActionButton } from '../../components/ActionButton';
import { connectAgent, disconnectAgent } from '../../net/transport';

const MILESTONES = ['Initiating remote connection…', 'Handshake sent…', 'Securing the channel…', 'Opening channels…'];
const HARD_TIMEOUT_MS = 12000;

export function ConnectScreen() {
  const { c, type } = useTheme();
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const { width, height } = useWindowDimensions();
  const agentId = route.params?.agentId as string;
  const agent = useStore((s) => s.agents.find((a) => a.id === agentId));
  const endpoint = useStore((s) => s.endpoints[agentId]);
  const connection = useStore((s) => s.connection);
  const setStore = useStore((s) => s.set);
  const [failed, setFailed] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const start = () => {
    setFailed(false);
    disconnectAgent();
    setStore({ currentAgentId: agentId, snapshot: null, connection: { kind: 'unknown' } });
    connectAgent(agentId);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      if (useStore.getState().connection.kind !== 'connected') setFailed(true);
    }, HARD_TIMEOUT_MS);
  };

  useEffect(() => {
    start();
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (connection.kind === 'connected') {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      const t = setTimeout(() => nav.replace('RemoteSession', { agentId }), 600);
      return () => clearTimeout(t);
    }
    if (connection.kind === 'offline') setFailed(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connection.kind]);

  // The most recent error explains why (rejected key vs unreachable).
  const reason = useStore((s) => s.events.find((e) => e.level === 'ERROR')?.message);

  if (failed) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000000' }}>
        <WaveBackground width={width} height={height} variant="magenta" dim />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <Ionicons name="cloud-offline-outline" size={48} color="#E5555D" />
          <Text style={[type.title2, { color: '#FFFFFF', marginTop: 18 }]}>Couldn't connect</Text>
          <Text style={[type.title3, { color: '#C9C9CE', marginTop: 8 }]}>
            {endpoint ? `${endpoint.ip}:${endpoint.port}` : agent?.name ?? ''}
          </Text>
          <Text style={[type.callout, { color: '#9A9AA0', marginTop: 14, textAlign: 'center', lineHeight: 22 }]}>
            {reason
              ? reason[0].toUpperCase() + reason.slice(1) + '.'
              : "The Pi didn't answer. Make sure it's powered on and on the same Wi-Fi."}
          </Text>
          <View style={{ height: 28 }} />
          <View style={{ width: 240, gap: 10 }}>
            <ActionButton label="Try again" onPress={start} />
            <ActionButton label="Back" variant="secondary" onPress={() => nav.goBack()} />
          </View>
        </View>
      </View>
    );
  }

  const caption =
    connection.kind === 'connecting'
      ? MILESTONES[connection.milestone]
      : connection.kind === 'connected'
        ? 'Connected'
        : MILESTONES[0];

  return (
    <View style={{ flex: 1, backgroundColor: '#000000' }}>
      <WaveBackground width={width} height={height} variant="magenta" dim />

      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <Text style={[type.title2, { color: '#FFFFFF' }]}>Connecting to</Text>
        <Text style={[type.title3, { color: '#C9C9CE', marginTop: 10 }]}>
          {endpoint ? `${endpoint.ip}:${endpoint.port}` : agent?.name ?? '—'}
        </Text>
        <View style={{ height: 40 }} />
        {connection.kind === 'connected' ? (
          <Ionicons name="checkmark-circle" size={34} color="#3CC06F" />
        ) : (
          <ActivityIndicator size="small" color="#C9C9CE" />
        )}
        <View style={{ height: 32 }} />
        <Text style={[type.callout, { color: '#9A9AA0' }]}>{caption}</Text>
      </View>

      <View style={{ alignItems: 'center', paddingBottom: 56 }}>
        <Pressable
          onPress={() => nav.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Cancel"
          style={({ pressed }) => ({
            width: 52,
            height: 52,
            borderRadius: 26,
            backgroundColor: pressed ? '#2A2A2E' : 'rgba(28,28,31,0.9)',
            alignItems: 'center',
            justifyContent: 'center',
          })}
        >
          <Ionicons name="close" size={22} color="#FFFFFF" />
        </Pressable>
      </View>
    </View>
  );
}
