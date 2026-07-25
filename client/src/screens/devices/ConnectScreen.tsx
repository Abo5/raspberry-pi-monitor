// "Connecting to" full-screen, in the Windows App style: dimmed bloom backdrop,
// centred progress, X to cancel. The milestone caption is driven by the real
// handshake events (P-D2), and success hands off to the Monitor tab.
import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, Pressable, Text, View, useWindowDimensions } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { useStore } from '../../store/useStore';
import { WaveBackground } from '../../components/WaveBackground';
import { startTunnel, stopTunnel } from '../../sim/tunnel';

const MILESTONES = ['Initiating remote connection…', 'Handshake sent…', 'Securing the channel…', 'Opening channels…'];

export function ConnectScreen() {
  const { type } = useTheme();
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const { width, height } = useWindowDimensions();
  const agentId = route.params?.agentId as string;
  const agent = useStore((s) => s.agents.find((a) => a.id === agentId));
  const connection = useStore((s) => s.connection);
  const currentId = useStore((s) => s.currentAgentId);
  const setStore = useStore((s) => s.set);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (agentId !== currentId || connection.kind !== 'connected') {
      stopTunnel();
      setStore({ currentAgentId: agentId, snapshot: null, connection: { kind: 'unknown' } });
      startTunnel();
    }
  }, []);

  useEffect(() => {
    if (connection.kind === 'connected') {
      const t = setTimeout(() => {
        nav.goBack();
        nav.navigate('MonitorTab');
      }, 700);
      return () => clearTimeout(t);
    }
  }, [connection.kind]);

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
        <Text style={[type.title3, { color: '#C9C9CE', marginTop: 10 }]}>{agent?.name ?? '—'}</Text>
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
