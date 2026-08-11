// StatusPill (§7.1) — the atom of P-D1. Never a bare coloured dot: glyph-or-dot
// + uppercase label, always.
import React from 'react';
import { Text, View, ViewStyle } from 'react-native';
import { useTheme } from '../theme';

export type PillStatus = 'ok' | 'info' | 'warning' | 'critical' | 'offline' | 'unknown' | 'connecting';

interface Props {
  status: PillStatus;
  label: string;
  detail?: string;
  size?: 'compact' | 'regular' | 'large';
  style?: ViewStyle;
}

export function StatusPill({ status, label, detail, size = 'regular', style }: Props) {
  const { c, type, radius } = useTheme();
  const tone =
    status === 'connecting' ? c.text.tertiary : c.status[status === 'ok' ? 'ok' : status];
  const isUnknown = status === 'unknown';
  const h = size === 'compact' ? 18 : size === 'large' ? 28 : 22;
  const dot = size === 'compact' ? 5 : size === 'large' ? 8 : 6;
  const fillAlpha = status === 'offline' ? 0.12 : 0.14;

  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          height: h,
          paddingHorizontal: size === 'large' ? 12 : size === 'compact' ? 6 : 8,
          borderRadius: radius.pill,
          backgroundColor: isUnknown || status === 'connecting' ? 'transparent' : withAlphaHex(tone, fillAlpha),
          borderWidth: isUnknown ? 1 : 0,
          borderColor: isUnknown ? tone : undefined,
          borderStyle: isUnknown ? 'dashed' : 'solid',
          alignSelf: 'flex-start',
        },
        style,
      ]}
    >
      <View
        style={{
          width: dot,
          height: dot,
          borderRadius: dot / 2,
          backgroundColor: isUnknown || status === 'connecting' ? 'transparent' : tone,
          borderWidth: isUnknown || status === 'connecting' ? 1 : 0,
          borderColor: tone,
          marginRight: 4,
        }}
      />
      <Text style={[type.micro, { color: tone, fontSize: size === 'large' ? 12 : 11 }]}>
        {label}
        {detail ? <Text style={{ color: c.text.tertiary }}>{' · ' + detail}</Text> : null}
      </Text>
    </View>
  );
}

function withAlphaHex(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
