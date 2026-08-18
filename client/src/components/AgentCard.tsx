// AgentCard (§7.2): StatusPill + lock + chevron / name / three micro-metrics.
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, withAlpha } from '../theme';
import { Agent, ConnectionState, Snapshot } from '../types';
import { fmtPct, fmtTemp } from '../lib/format';
import { StatusPill } from './StatusPill';

interface Props {
  agent: Agent;
  connection: ConnectionState;
  snapshot: Snapshot | null;
  selected?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
}

export function AgentCard({ agent, connection, snapshot, selected, onPress, onLongPress }: Props) {
  const { c, type, radius } = useTheme();

  const pill =
    connection.kind === 'connected' ? (
      <StatusPill status="ok" label="ONLINE" detail={`${connection.path} · ${connection.rttMs}ms`} />
    ) : connection.kind === 'connecting' ? (
      <StatusPill status="connecting" label="CONNECTING" />
    ) : connection.kind === 'offline' ? (
      <StatusPill status="offline" label="OFFLINE" />
    ) : (
      <StatusPill status="unknown" label="NOT CONTACTED" />
    );

  const v = snapshot?.values;
  const metrics: [string, string][] = v
    ? [
        ['CPU', `${fmtPct(v['cpu.util_pct'] ?? 0)}%`],
        ['SOC', `${fmtTemp(v['cpu.temp_c'] ?? 0)}°C`],
        ['MEM', `${fmtPct(v['mem.used_pct'] ?? 0)}%`],
      ]
    : [];

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityLabel={`${agent.name}, ${connection.kind}`}
      style={({ pressed }) => ({
        minHeight: 88,
        padding: 16,
        borderRadius: radius.l,
        backgroundColor: selected ? withAlpha(c.accent.base, c.accent.washAlpha) : pressed ? c.surface.raised2 : c.surface.raised,
        borderWidth: selected ? 2 : 1,
        borderColor: selected ? c.accent.base : c.border.subtle,
      })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {pill}
        <View style={{ flex: 1 }} />
        {agent.verifiedAt && <Ionicons name="lock-closed" size={12} color={c.text.tertiary} />}
        <Ionicons name="chevron-forward" size={14} color={c.text.tertiary} style={{ marginLeft: 6 }} />
      </View>
      <Text style={[type.title3, { color: c.text.primary, marginTop: 6 }]}>{agent.name}</Text>
      {metrics.length > 0 && (
        <View style={{ flexDirection: 'row', marginTop: 6, gap: 16 }}>
          {metrics.map(([label, value]) => (
            <View key={label} style={{ flexDirection: 'row', alignItems: 'baseline' }}>
              <Text style={[type.micro, { color: c.text.tertiary }]}>{label} </Text>
              <Text style={[type.metricM, { color: connection.kind === 'connected' ? c.text.primary : c.text.secondary, fontSize: 14 }]}>
                {value}
              </Text>
            </View>
          ))}
        </View>
      )}
    </Pressable>
  );
}
