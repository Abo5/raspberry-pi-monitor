// Onboarding — Install the Agent (§3.3).
import React, { useState } from 'react';
import { Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../theme';
import { Screen } from '../../components/Shared';
import { ActionButton } from '../../components/ActionButton';

const INSTALL_LINE = 'curl -fsSL https://pimon.dev/get.sh | sudo sh';

export function Install() {
  const { c, type, radius } = useTheme();
  const nav = useNavigation<any>();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await Clipboard.setStringAsync(INSTALL_LINE);
    Haptics.selectionAsync();
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <Screen>
      <Text style={[type.title1, { color: c.text.primary }]}>Run this on your Pi</Text>
      <Text style={[type.callout, { color: c.text.secondary, marginTop: 8 }]}>
        Open a terminal on the Pi, or SSH into it, and paste this line.
      </Text>

      <View
        style={{
          backgroundColor: c.surface.sunken,
          borderRadius: radius.s,
          padding: 14,
          marginTop: 16,
        }}
      >
        <Text style={[type.monoBody, { color: c.text.primary }]}>{INSTALL_LINE}</Text>
      </View>
      <ActionButton label={copied ? 'Copied' : 'Copy'} variant="tertiary" onPress={copy} style={{ alignSelf: 'flex-end' }} />

      <View style={{ borderTopWidth: 1, borderTopColor: c.border.hairline, marginTop: 8, paddingTop: 16 }}>
        <Text style={[type.micro, { color: c.text.tertiary }]}>WHAT THIS DOES</Text>
        <Text style={[type.subhead, { color: c.text.secondary, marginTop: 8 }]}>
          Installs a single binary and a systemd service. It opens no inbound ports. Details are in the deployment guide.
        </Text>
      </View>

      <View style={{ borderTopWidth: 1, borderTopColor: c.border.hairline, marginTop: 20, paddingTop: 16, marginBottom: 24 }}>
        <Text style={[type.callout, { color: c.text.primary }]}>
          When it finishes, the Pi will print a QR code.
        </Text>
      </View>

      <ActionButton label="I see the QR code" onPress={() => nav.navigate('ScanQR')} />
    </Screen>
  );
}
