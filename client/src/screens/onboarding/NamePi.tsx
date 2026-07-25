// Onboarding — Name this Pi (§4.3). Host facts are the user's second
// confirmation that they paired with the machine they meant to.
import React, { useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTheme } from '../../theme';
import { Screen } from '../../components/Shared';
import { ActionButton } from '../../components/ActionButton';
import { StatusPill } from '../../components/StatusPill';

const HOSTNAME = 'pi5-livingroom';

export function NamePi() {
  const { c, type, radius } = useTheme();
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const { hex, words } = route.params as { hex: string; words: string[] };
  const [name, setName] = useState(HOSTNAME);

  return (
    <Screen>
      <StatusPill status="ok" label="VERIFIED" detail="direct · 28ms" size="large" />

      <Text style={[type.title1, { color: c.text.primary, marginTop: 20 }]}>
        What should we call it?
      </Text>

      <TextInput
        value={name}
        onChangeText={setName}
        autoCapitalize="none"
        autoCorrect={false}
        style={[
          type.body,
          {
            color: c.text.primary,
            borderWidth: 1,
            borderColor: c.border.strong,
            borderRadius: radius.s,
            paddingHorizontal: 14,
            paddingVertical: 12,
            marginTop: 16,
          },
        ]}
      />
      <Text style={[type.footnote, { color: c.text.tertiary, marginTop: 6 }]}>
        Its hostname is {HOSTNAME}.
      </Text>

      <View style={{ borderTopWidth: 1, borderTopColor: c.border.hairline, marginTop: 24, paddingTop: 12, gap: 4 }}>
        <Text style={[type.micro, { color: c.text.tertiary }]}>RASPBERRY PI 5 · 8 GB</Text>
        <Text style={[type.micro, { color: c.text.tertiary }]}>RASPBERRY PI OS TRIXIE (64-BIT)</Text>
        <Text style={[type.micro, { color: c.text.tertiary }]}>AGENT 1.0.0 · UP 3 MINUTES</Text>
      </View>

      <ActionButton
        label="Continue"
        onPress={() => nav.navigate('Permissions', { hex, words, name: name.trim() })}
        disabled={!name.trim()}
        disabledReason="A name helps when you have more than one Pi."
        style={{ marginTop: 32 }}
      />
    </Screen>
  );
}
