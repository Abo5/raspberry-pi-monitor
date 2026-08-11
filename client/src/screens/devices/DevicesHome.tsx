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
      hitSlop={8}
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
  const endpoints = useStore((s) => s.endpoints);
  const [showSwitcher, setShowSwitcher] = useState(false);

  // Tap a device → straight into the remote desktop. Long-press → its details.
  const openDevice = (agentId: string) => {
    nav.navigate('Connect', { agentId });
  };

  const unacked = alerts.filter((a) => a.resolvedAt == null && a.acknowledgedAt == null).length;
  const cardW = width - 32;
  const cardH = 236;

  return (
    <View style={{ flex: 1, backgroundColor: '#000000', paddingTop: insets.top }}>
      {/* Top circular buttons */}
      <View style={{ flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 10, gap: 10 }}>
        <CircleButton icon="menu" onPress={() => setShowSwitcher(true)} />
        <View style={{ flex: 1 }} />
        <CircleButton icon="notifications-outline" badge={unacked} onPress={() => nav.navigate('AlertsTab')} />
        <CircleButton icon="add" onPress={() => nav.navigate('AddRealPi', {})} />
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
            onAction={() => nav.navigate('AddRealPi', {})}
          />
        ) : (
          <View style={{ gap: 16 }}>
            {agents.map((agent, i) => {
              const isCurrent = agent.id === currentId;
              const v = isCurrent ? snapshot?.values : null;
              const ep = endpoints[agent.id];
              return (
                <Pressable
                  key={agent.id}
                  onPress={() => openDevice(agent.id)}
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
                  <WaveBackground
                    width={cardW}
                    height={cardH}
                    variant={VARIANTS[i % VARIANTS.length]}
                    bottomScrim={cardH * 0.5}
                  />

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

                  {/* bottom label — sits over the wave's fade, no hard seam */}
                  <View
                    style={{
                      position: 'absolute',
                      left: 0,
                      right: 0,
                      bottom: 0,
                      paddingHorizontal: 18,
                      paddingBottom: 18,
                    }}
                  >
                    <Text style={[type.title2, { color: '#FFFFFF' }]} numberOfLines={1}>
                      {agent.name}
                    </Text>
                    <Text style={[type.subhead, { color: '#C9C9CE', marginTop: 3 }]} numberOfLines={1}>
                      {ep ? `${ep.ip}:${ep.port}` : `${agent.hostname}.local`}
                      {(() => {
                        // Only metrics that actually exist — never a fabricated 0.
                        if (!v) return '';
                        const segs = [
                          v['cpu.temp_c'] != null ? `${fmtTemp(v['cpu.temp_c'])}°C` : null,
                          v['cpu.util_pct'] != null ? `CPU ${fmtPct(v['cpu.util_pct'])}%` : null,
                        ].filter(Boolean);
                        return segs.length ? `   ·   ${segs.join(' · ')}` : '';
                      })()}
                    </Text>
                  </View>
                </Pressable>
              );
            })}

            {/* Add-device affordance so the list never reads as sparse/empty */}
            <Pressable
              onPress={() => nav.navigate('AddRealPi', {})}
              accessibilityRole="button"
              accessibilityLabel="Pair another Pi"
              style={({ pressed }) => ({
                height: 88,
                borderRadius: 24,
                borderWidth: 1.5,
                borderColor: pressed ? '#3A3A40' : '#242428',
                borderStyle: 'dashed',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'row',
                gap: 10,
                backgroundColor: pressed ? '#141416' : 'transparent',
              })}
            >
              <Ionicons name="add-circle-outline" size={22} color="#8A8A90" />
              <Text style={[type.body, { color: '#B4B4BA', fontWeight: '600' }]}>Pair another Pi</Text>
            </Pressable>
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
