// Onboarding — Notifications & widgets (§4.4). Each permission is explained in
// terms of what breaks without it; never a bare system prompt.
import React from 'react';
import { Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { Screen, Card } from '../../components/Shared';
import { ActionButton } from '../../components/ActionButton';
import { useStore } from '../../store/useStore';
import { startTunnel } from '../../sim/tunnel';
import { DEFAULT_ACTIONS, DEFAULT_RULES } from '../../sim/seed';

export function Permissions() {
  const { c, type } = useTheme();
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const { hex, words, name } = route.params as { hex: string; words: string[]; name: string };

  const finish = () => {
    const now = Date.now();
    const wasPaired = useStore.getState().paired;
    if (!wasPaired) {
      useStore.getState().set({ rules: DEFAULT_RULES, actions: DEFAULT_ACTIONS });
    }
    useStore.getState().pairAgent({
      id: `agent-${now}`,
      name,
      hostname: 'pi5-livingroom',
      model: 'Raspberry Pi 5 · 8 GB',
      os: 'Raspberry Pi OS Trixie (64-bit)',
      agentVersion: '1.0.0',
      fingerprintHex: hex,
      fingerprintWords: words,
      pairedAt: now,
      verifiedAt: now,
    });
    startTunnel();
    // Pairing a second Pi happens inside the main tabs; return to the stack root.
    if (wasPaired) nav.popToTop();
  };

  return (
    <Screen>
      <Text style={[type.title1, { color: c.text.primary }]}>
        Get told when something's wrong
      </Text>

      <Card style={{ marginTop: 20, padding: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Ionicons name="notifications-outline" size={18} color={c.text.primary} />
          <Text style={[type.bodyEmph, { color: c.text.primary, marginLeft: 8 }]}>Alerts</Text>
        </View>
        <Text style={[type.subhead, { color: c.text.secondary, marginTop: 8 }]}>
          Your Pi decides when to warn you. The notification travels empty — the text is put
          together on this phone.
        </Text>
        <ActionButton label="Turn on" variant="secondary" onPress={() => {}} style={{ marginTop: 12, alignSelf: 'flex-end' }} />
      </Card>

      <Card style={{ marginTop: 12, padding: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Ionicons name="extension-puzzle-outline" size={18} color={c.text.primary} />
          <Text style={[type.bodyEmph, { color: c.text.primary, marginLeft: 8 }]}>Widgets</Text>
        </View>
        <Text style={[type.subhead, { color: c.text.secondary, marginTop: 8 }]}>
          Put temperature and load on your Home or Lock Screen. They update a few times an hour and
          always show how old the numbers are.
        </Text>
      </Card>

      <ActionButton label="Done" onPress={finish} style={{ marginTop: 32 }} />
      <ActionButton label="Skip for now" variant="tertiary" onPress={finish} style={{ marginTop: 8 }} />
    </Screen>
  );
}
