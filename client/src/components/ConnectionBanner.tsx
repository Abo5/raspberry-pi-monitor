// ConnectionBanner (§7.10) — 20pt strip under the nav bar. The connecting rail
// advances on real handshake milestones; the liveness dot pulses once per
// Snapshot received (§6.3) and stops immediately when Snapshots stop.
import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme';
import { useStore } from '../store/useStore';
import { fmtClock } from '../lib/format';

export function ConnectionBanner({ onPress }: { onPress?: () => void }) {
  const { c, type } = useTheme();
  const connection = useStore((s) => s.connection);
  const snapshot = useStore((s) => s.snapshot);
  const pulse = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    if (!snapshot) return;
    pulse.setValue(1);
    Animated.timing(pulse, { toValue: 0.35, duration: 1200, useNativeDriver: true }).start();
  }, [snapshot?.receivedAt]);

  let ink = c.text.secondary;
  let glyph: React.ReactNode = null;
  let label = '';
  let showDot = false;
  let rail: number | null = null;

  switch (connection.kind) {
    case 'unknown':
      ink = c.status.unknown;
      glyph = <Ionicons name="help-circle-outline" size={12} color={ink} />;
      label = 'NOT CONTACTED';
      break;
    case 'connecting':
      ink = c.text.tertiary;
      glyph = <Ionicons name="flash-outline" size={12} color={ink} />;
      label = 'CONNECTING';
      rail = (connection.milestone + 1) / 4;
      break;
    case 'connected':
      glyph = <Ionicons name="flash" size={12} color={c.accent.base} />;
      label = `DIRECT · ${connection.rttMs}ms`;
      showDot = true;
      break;
    case 'reconnecting':
      ink = c.status.info;
      glyph = <Ionicons name="sync-outline" size={12} color={ink} />;
      label = `RECONNECTING · attempt ${connection.attempt} · next try ${connection.nextTryInS}s`;
      break;
    case 'offline':
      ink = c.status.offline;
      glyph = <Ionicons name="flash-off-outline" size={12} color={ink} />;
      label = `OFFLINE · last seen ${fmtClock(connection.lastSeen)}`;
      break;
  }

  const verified = connection.kind === 'connected' && connection.verified;

  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`Connection: ${label}`}>
      <View
        style={{
          height: 22,
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 16,
          backgroundColor: c.surface.raised,
          borderBottomWidth: 1,
          borderBottomColor: c.border.hairline,
        }}
      >
        {glyph}
        <Text style={[type.micro, { color: ink, marginLeft: 4 }]} numberOfLines={1}>
          {label}
        </Text>
        {verified && (
          <>
            <Text style={[type.micro, { color: c.text.tertiary }]}> · </Text>
            <Ionicons name="lock-closed" size={10} color={c.accent.base} />
            <Text style={[type.micro, { color: ink, marginLeft: 2 }]}>verified</Text>
          </>
        )}
        <View style={{ flex: 1 }} />
        {showDot && (
          <Animated.View
            style={{
              width: 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: c.accent.base,
              opacity: pulse,
            }}
          />
        )}
      </View>
      {rail != null && (
        <View style={{ height: 2, backgroundColor: c.surface.raised2 }}>
          <View style={{ height: 2, width: `${rail * 100}%`, backgroundColor: c.accent.base }} />
        </View>
      )}
    </Pressable>
  );
}
