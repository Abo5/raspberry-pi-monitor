// Onboarding — Welcome (§3.2), original design. "Set up my Pi" opens the
// Raspberry Pi Connect sign-in; if the background check found an expired
// session, the sign-in screen opens by itself once this screen has settled.
import React, { useEffect, useRef } from 'react';
import { Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { useStore } from '../../store/useStore';
import { connectSignOutReason } from '../../net/connect';
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
  const connectStatus = useStore((s) => s.connectStatus);
  const autoOpened = useRef(false);

  // No valid Raspberry Pi Connect session → open sign-in once.
  useEffect(() => {
    if (connectStatus !== 'signedOut' || autoOpened.current) return;
    // The user just signed out on purpose: stay here until they tap sign-in.
    if (connectSignOutReason.manual) {
      connectSignOutReason.manual = false;
      autoOpened.current = true;
      return;
    }
    const t = setTimeout(() => {
      // Re-check at fire time: a quick sign-in/out can change things meanwhile.
      if (useStore.getState().connectStatus !== 'signedOut' || !nav.isFocused()) return;
      autoOpened.current = true;
      nav.navigate('ConnectLogin');
    }, 400);
    return () => clearTimeout(t);
  }, [connectStatus, nav]);

  return (
    <Screen style={{ flexGrow: 1, justifyContent: 'center' }}>
      <View style={{ alignItems: 'center', marginBottom: 32 }}>
        <Ionicons name="server-outline" size={56} color={c.accent.base} />
        <Text style={[type.display, { color: '#FFFFFF', marginTop: 24, textAlign: 'center' }]}>
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

      <ActionButton label="Set up my Pi" onPress={() => nav.navigate('ConnectLogin')} />
    </Screen>
  );
}
