// Settings → Security (§14). Changing a security setting requires biometric
// re-auth (§17.2) — including turning the requirement off.
import React from 'react';
import { Switch } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../theme';
import { useStore } from '../../store/useStore';
import { Screen, Card, ListRow, Eyebrow } from '../../components/Shared';

export function SecuritySettings() {
  const { c } = useTheme();
  const nav = useNavigation<any>();
  const settings = useStore((s) => s.settings);
  const setSettings = useStore((s) => s.setSettings);
  const actions = useStore((s) => s.actions);

  // The toggle is locked on while any destructive Action exists (§14).
  const lockedOn = actions.some((a) => a.destructive);

  const toggleBio = async (v: boolean) => {
    if (await LocalAuthentication.hasHardwareAsync()) {
      const res = await LocalAuthentication.authenticateAsync({ promptMessage: 'Change a security setting' });
      if (!res.success) return;
    }
    setSettings({ requireBioShellDesktop: v });
  };

  return (
    <Screen>
      <Eyebrow>AUTHENTICATION</Eyebrow>
      <Card>
        <ListRow
          title="Require Face ID for shell & desktop"
          subtitle={lockedOn ? 'Locked on: a destructive action exists in the allow-list' : undefined}
          right={
            <Switch
              value={settings.requireBioShellDesktop || lockedOn}
              disabled={lockedOn}
              onValueChange={toggleBio}
              trackColor={{ true: c.accent.base }}
              style={{ transform: [{ scale: 0.8 }] }}
            />
          }
          last
        />
      </Card>

      <Eyebrow>KEYS & DEVICES</Eyebrow>
      <Card>
        <ListRow title="Security log" chevron onPress={() => nav.navigate('SecurityLog')} last />
      </Card>
    </Screen>
  );
}
