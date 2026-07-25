// Raspberry App — Devices home, in the Windows App visual language: pure-black
// canvas, circular top buttons, "Saved Devices" headline, and big rounded
// device cards with a bloom-wave artwork.
import React, { useState } from 'react';
import { Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { useStore } from '../../store/useStore';
import { WaveBackground } from '../../components/WaveBackground';
import { AgentSwitcher } from '../../components/AgentSwitcher';
import { StatusPill } from '../../components/StatusPill';
import { EmptyState } from '../../components/States';
import { fmtTemp, fmtPct } from '../../lib/format';

const VARIANTS = ['magenta', 'cyan', 'violet', 'ember'] as const;

function CircleButton({
  icon, onPress, badge,
}: { icon: keyof typeof Ionicons.glyphMap; onPress?: () => void; badge?: number }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => ({
        width: 46,
        height: 46,
        borderRadius: 23,
        backgroundColor: pressed ? '#2A2A2E' : '#1C1C1F',
        alignItems: 'center',
        justifyContent: 'center',
      })}
    >
      <Ionicons name={icon} size={20} color="#EDEDF0" />
      {badge != null && badge > 0 && (
        <View
          style={{
            position: 'absolute',
            top: 2,
            right: 2,
            minWidth: 17,
            height: 17,
            borderRadius: 9,
            backgroundColor: '#E5484D',
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 4,
          }}
        >
          <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>{badge}</Text>
        </View>
      )}
    </Pressable>
  );
}

export function DevicesHome() {
  const { type } = useTheme();
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const agents = useStore((s) => s.agents);
  const currentId = useStore((s) => s.currentAgentId);
  const connection = useStore((s) => s.connection);
  const snapshot = useStore((s) => s.snapshot);
  const alerts = useStore((s) => s.alerts);
  const [showSwitcher, setShowSwitcher] = useState(false);

  const unacked = alerts.filter((a) => a.resolvedAt == null && a.acknowledgedAt == null).length;
  const cardW = width - 32;
  const cardH = 220;

  return (
    <View style={{ flex: 1, backgroundColor: '#000000', paddingTop: insets.top }}>
      {/* Top circular buttons */}
      <View style={{ flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 10, gap: 10 }}>
        <CircleButton icon="menu" onPress={() => setShowSwitcher(true)} />
        <View style={{ flex: 1 }} />
        <CircleButton icon="notifications-outline" badge={unacked} onPress={() => nav.navigate('AlertsTab')} />
        <CircleButton icon="add" onPress={() => nav.navigate('ScanQR')} />
        <CircleButton icon="ellipsis-horizontal" onPress={() => nav.navigate('SettingsTab')} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 140 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
          <Ionicons name="chevron-down" size={20} color="#9A9AA0" />
          <Text style={[type.display, { color: '#FFFFFF', fontSize: 30, marginLeft: 6 }]}>Saved Devices</Text>
        </View>

        {agents.length === 0 ? (
          <EmptyState
            icon="server-outline"
            title="No Pis yet"
            body="Pair a Raspberry Pi to see it here. It takes about two minutes."
            actionLabel="Pair a Pi"
            onAction={() => nav.navigate('ScanQR')}
          />
        ) : (
          <View style={{ gap: 16 }}>
            {agents.map((agent, i) => {
              const isCurrent = agent.id === currentId;
              const v = isCurrent ? snapshot?.values : null;
              return (
                <Pressable
                  key={agent.id}
                  onPress={() => nav.navigate('Connect', { agentId: agent.id })}
                  onLongPress={() => nav.navigate('AgentDetail', { agentId: agent.id })}
                  accessibilityRole="button"
                  accessibilityLabel={`Connect to ${agent.name}`}
                  style={({ pressed }) => ({
                    width: cardW,
                    height: cardH,
                    borderRadius: 24,
                    overflow: 'hidden',
                    backgroundColor: '#111114',
                    transform: [{ scale: pressed ? 0.985 : 1 }],
                  })}
                >
                  <WaveBackground width={cardW} height={cardH * 0.72} variant={VARIANTS[i % VARIANTS.length]} />

                  {/* chip + status */}
                  <View style={{ flexDirection: 'row', padding: 14 }}>
                    <View
                      style={{
                        backgroundColor: 'rgba(20,20,24,0.72)',
                        borderRadius: 18,
                        paddingHorizontal: 14,
                        paddingVertical: 8,
                      }}
                    >
                      <Text style={[type.subhead, { color: '#FFFFFF', fontWeight: '600' }]}>Pi Connection</Text>
                    </View>
                    <View style={{ flex: 1 }} />
                    {isCurrent && (
                      <StatusPill
                        status={
                          connection.kind === 'connected' ? 'ok' : connection.kind === 'offline' ? 'offline' : connection.kind === 'connecting' ? 'connecting' : 'unknown'
                        }
                        label={
                          connection.kind === 'connected' ? 'ONLINE' : connection.kind === 'offline' ? 'OFFLINE' : connection.kind === 'connecting' ? 'CONNECTING' : 'SAVED'
                        }
                      />
                    )}
                  </View>

                  {/* bottom strip */}
                  <View
                    style={{
                      position: 'absolute',
                      left: 0,
                      right: 0,
                      bottom: 0,
                      height: cardH * 0.3,
                      backgroundColor: 'rgba(12,12,15,0.86)',
                      paddingHorizontal: 18,
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={[type.title2, { color: '#FFFFFF' }]} numberOfLines={1}>
                      {agent.name}
                    </Text>
                    <Text style={[type.subhead, { color: '#9A9AA0', marginTop: 2 }]} numberOfLines={1}>
                      {agent.hostname}.local
                      {v
                        ? `   ·   ${fmtTemp(v['cpu.temp_c'] ?? 0)}°C · CPU ${fmtPct(v['cpu.util_pct'] ?? 0)}%`
                        : ''}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>

      <AgentSwitcher
        visible={showSwitcher}
        onClose={() => setShowSwitcher(false)}
        onSeeAll={() => nav.navigate('AgentList')}
      />
    </View>
  );
}
