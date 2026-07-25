// Onboarding — Verify the fingerprint (§4.2). The trust decision. The exact
// explanation copy is normative (string table sec.verify.body). The trust
// record is written only after biometric confirmation succeeds.
import React, { useState } from 'react';
import { Alert as RNAlert, Text, View } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTheme } from '../../theme';
import { Screen } from '../../components/Shared';
import { ActionButton } from '../../components/ActionButton';
import { FingerprintBlock } from '../../components/Fingerprint';

export function Verify() {
  const { c, type } = useTheme();
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const { hex, words } = route.params as { hex: string; words: string[] };
  const [confirming, setConfirming] = useState(false);

  const confirm = async () => {
    setConfirming(true);
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      if (hasHardware) {
        const res = await LocalAuthentication.authenticateAsync({
          promptMessage: "Save this Pi's identity",
        });
        if (!res.success) {
          setConfirming(false);
          return;
        }
      }
      nav.navigate('NamePi', { hex, words });
    } finally {
      setConfirming(false);
    }
  };

  const reject = () => {
    RNAlert.alert(
      'Setup cancelled',
      'Nothing was saved and no trust was established. If you expected the codes to match, check that you scanned the QR code on the Pi you meant to — and that nobody else is showing you one.',
      [{ text: 'Start over', onPress: () => nav.popToTop() }],
    );
  };

  return (
    <Screen>
      <Text style={[type.title1, { color: c.text.primary }]}>Check that this is really your Pi</Text>

      <View style={{ marginTop: 20 }}>
        <FingerprintBlock hex={hex} words={words} />
      </View>
      <Text style={[type.footnote, { color: c.text.tertiary, marginTop: 8, textAlign: 'center' }]}>
        Easier to compare out loud: {words.join(' · ')}
      </Text>

      <Text style={[type.callout, { color: c.text.secondary, marginTop: 20 }]}>
        Below is a short code made from your Pi's own identity key. Your Pi is showing the same code
        on its screen right now.{'\n\n'}
        If the two codes match, nothing is sitting in the middle of this connection, and this phone
        and this Pi can talk privately from now on.{'\n\n'}
        If they don't match, stop. Someone or something else answered instead of your Pi. Tap "They
        don't match" and we'll cancel the setup.{'\n\n'}
        You only have to do this once.
      </Text>

      <View style={{ marginTop: 24, gap: 10 }}>
        <ActionButton label="They match" onPress={confirm} loading={confirming} loadingLabel="Confirming…" />
        <ActionButton label="They don't match" variant="destructive" onPress={reject} />
      </View>
    </Screen>
  );
}
