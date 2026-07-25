// Onboarding — Welcome (§3.2). The three claim rows are the mental model the
// rest of the app depends on (README P1, P2, P4).
import React from 'react';
import { Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { Screen } from '../../components/Shared';
import { ActionButton } from '../../components/ActionButton';

const CLAIMS: [keyof typeof Ionicons.glyphMap, string][] = [
  ['lock-closed-outline', 'Nothing we run can read your traffic.'],
  ['flash-outline', 'No ports open on your Pi.'],
  ['location-outline', 'History lives on the Pi, not in an account.'],
];

export function Welcome() {
  const { c, type } = useTheme();
  const nav = useNavigation<any>();
  return (
    <Screen style={{ flexGrow: 1, justifyContent: 'center' }}>
      <View style={{ alignItems: 'center', marginBottom: 32 }}>
        <Ionicons name="server-outline" size={56} color={c.accent.base} />
        <Text style={[type.display, { color: c.text.primary, marginTop: 24, textAlign: 'center' }]}>
          Your Pi, from anywhere
        </Text>
        <Text style={[type.callout, { color: c.text.secondary, marginTop: 12, textAlign: 'center', maxWidth: 300 }]}>
          This app talks to a small program on your Raspberry Pi. Only your phone and your Pi hold the keys.
        </Text>
      </View>

      <View style={{ borderTopWidth: 1, borderTopColor: c.border.hairline, paddingTop: 20, gap: 14, marginBottom: 40 }}>
        {CLAIMS.map(([icon, text]) => (
          <View key={text} style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name={icon} size={16} color={c.accent.base} />
            <Text style={[type.subhead, { color: c.text.primary, marginLeft: 12, flex: 1 }]}>{text}</Text>
          </View>
        ))}
      </View>

      <ActionButton label="Set up my Pi" onPress={() => nav.navigate('Install')} />
      <ActionButton
        label="I already have the Agent running"
        variant="tertiary"
        onPress={() => nav.navigate('ScanQR')}
        style={{ marginTop: 8 }}
      />
    </Screen>
  );
}
