// FingerprintVerificationView content (§7.12): hex block grouped in 4s at 20pt,
// then the six-word sequence — spoken comparison beats hex comparison.
import React from 'react';
import { Text, View } from 'react-native';
import { useTheme } from '../theme';
import { hexGroups } from '../lib/fingerprint';

export function FingerprintBlock({ hex, words }: { hex: string; words: string[] }) {
  const { c, type, radius } = useTheme();
  const groups = hexGroups(hex);
  const line1 = groups.slice(0, 4).join('  ');
  const line2 = groups.slice(4, 8).join('  ');

  return (
    <View>
      <View
        style={{
          backgroundColor: c.surface.sunken,
          borderRadius: radius.s,
          padding: 16,
          alignItems: 'center',
        }}
      >
        <Text style={[type.monoBody, { fontSize: 20, lineHeight: 28, color: c.text.primary }]}>{line1}</Text>
        <Text style={[type.monoBody, { fontSize: 20, lineHeight: 28, color: c.text.primary }]}>{line2}</Text>
      </View>
      <View
        style={{
          backgroundColor: c.surface.raised,
          borderWidth: 1,
          borderColor: c.border.subtle,
          borderRadius: radius.s,
          padding: 16,
          marginTop: 12,
          alignItems: 'center',
        }}
      >
        <Text style={[type.title3, { color: c.text.primary, textAlign: 'center' }]}>
          {words.slice(0, 4).join(' · ')}
        </Text>
        <Text style={[type.title3, { color: c.text.primary, textAlign: 'center' }]}>
          {words.slice(4).join(' · ')}
        </Text>
      </View>
    </View>
  );
}
