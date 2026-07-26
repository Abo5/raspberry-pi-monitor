// Control hub (§9): the three ways to act on the Pi, preconditions visible
// before the user commits. Shell/Desktop require biometric re-auth (§17.2).
import React from 'react';
import { Text, View } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../theme';
import { useStore } from '../../store/useStore';
import { Screen, Card, ListRow } from '../../components/Shared';
import { ConnectionBanner } from '../../components/ConnectionBanner';
import { fmtDuration } from '../../lib/format';

export function ControlHub() {
  const { c, type } = useTheme();
  const nav = useNavigation<any>();
  const agent = useStore((s) => s.agents.find((a) => a.id === s.currentAgentId));
  const connection = useStore((s) => s.connection);
  const actions = useStore((s) => s.actions);
  const shellStartedAt = useStore((s) => s.shellSessionStartedAt);
  const requireBio = useStore((s) => s.settings.requireBioShellDesktop);

  const connected = connection.kind === 'connected';
  const offlineReason = connected ? undefined : `${agent?.name ?? 'This Pi'} is offline`;
  const confirmCount = actions.filter((a) => a.destructive).length;

  const gate = async (screen: string) => {
    if (requireBio && (await LocalAuthentication.hasHardwareAsync())) {
      const res = await LocalAuthentication.authenticateAsync({
        promptMessage: `Open ${screen === 'Shell' ? 'a shell' : 'the desktop'} on ${agent?.name}`,
      });
      if (!res.success) return;
    }
    nav.navigate(screen);
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.surface.canvas }}>
      <ConnectionBanner onPress={() => nav.navigate('Diagnostics')} />
      <Screen>
        <View style={{ gap: 12 }}>
          <Card>
            <ListRow
              icon="desktop-outline"
              title="Remote Desktop"
              subtitle={connected ? 'Wayland session on HDMI-1 · est. 4.2 Mb/s' : offlineReason}
              chevron
              disabled={!connected}
              onPress={() => gate('Desktop')}
              last
            />
          </Card>
          <Card>
            <ListRow
              icon="terminal-outline"
              title="Remote Shell"
              subtitle={
                !connected
                  ? offlineReason
                  : shellStartedAt
                    ? `1 SESSION RUNNING · ${fmtDuration((Date.now() - shellStartedAt) / 1000)}`
                    : '/bin/bash as pi'
              }
              chevron
              disabled={!connected}
              onPress={() => gate('Shell')}
              last
            />
          </Card>
          <Card>
            <ListRow
              icon="flash-outline"
              title="Actions"
              subtitle={`${actions.length} allowed · ${confirmCount} need confirmation`}
              chevron
              disabled={!connected}
              onPress={() => nav.navigate('Actions')}
              last
            />
          </Card>
        </View>
        <Text style={[type.footnote, { color: c.text.tertiary, marginTop: 20, textAlign: 'center' }]}>
          Both Remote Desktop and Remote Shell ask for Face ID before they open.
        </Text>
      </Screen>
    </View>
  );
}
