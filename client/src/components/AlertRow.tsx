// AlertRow (§7.13): 3pt leading severity stripe, glyph + micro label, tabular age.
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme';
import { Alert } from '../types';
import { fmtRelative, fmtValue } from '../lib/format';

const GLYPHS: Record<string, keyof typeof Ionicons.glyphMap> = {
  info: 'information-circle',
  warning: 'warning',
  critical: 'alert-circle',
};

export function AlertRow({
  alert, agentName, onPress,
}: { alert: Alert; agentName: string; onPress?: () => void }) {
  const { c, type, radius } = useTheme();
  const resolved = alert.resolvedAt != null;
  const acked = alert.acknowledgedAt != null || alert.snoozedUntil != null;
  const tone = resolved ? c.status.ok : c.status[alert.severity];
  const f = fmtValue(alert.seriesKey, alert.peak.v);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => ({
        flexDirection: 'row',
        minHeight: 72,
        backgroundColor: pressed ? c.surface.raised2 : c.surface.raised,
        borderRadius: radius.l,
        borderWidth: 1,
        borderColor: c.border.subtle,
        overflow: 'hidden',
        opacity: acked && !resolved ? 0.6 : 1,
      })}
    >
      <View style={{ width: 3, backgroundColor: tone, opacity: resolved ? 0.5 : acked ? 0.3 : 1 }} />
      <View style={{ flex: 1, paddingHorizontal: 16, paddingVertical: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Ionicons name={resolved ? 'checkmark-circle' : GLYPHS[alert.severity]} size={13} color={tone} />
          <Text style={[type.micro, { color: tone, marginLeft: 4 }]}>
            {resolved ? 'RESOLVED' : alert.severity.toUpperCase()}
          </Text>
          <Text style={[type.bodyEmph, { color: resolved ? c.text.secondary : c.text.primary, marginLeft: 8, flex: 1 }]} numberOfLines={1}>
            {alert.title}
          </Text>
          <Text style={[type.metricS, { color: c.text.tertiary }]}>
            {resolved ? '' : fmtRelative(alert.firedAt)}
          </Text>
        </View>
        <Text style={[type.subhead, { color: c.text.secondary, marginTop: 4 }]} numberOfLines={1}>
          {agentName} · peak {f.value}
          {f.unit ? ` ${f.unit}` : ''}
          {resolved && alert.resolvedAt
            ? ` · ${fmtRelative(alert.firedAt)} → ${fmtRelative(alert.resolvedAt)}`
            : alert.snoozedUntil && alert.snoozedUntil > Date.now()
              ? ' · snoozed'
              : alert.acknowledgedAt
                ? ' · acknowledged'
                : ''}
        </Text>
      </View>
    </Pressable>
  );
}
