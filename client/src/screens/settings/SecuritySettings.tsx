// Settings → Security (§14). Face ID for shell & desktop starts OFF; the user can
// turn it on (Face ID is checked once, so it's known to work) or off (Face ID
// confirms it's them). Without Face ID set up on the iPhone it can't be turned on.
import React from 'react';
import { Alert, Switch } from 'react-native';
import { biometricAvailable, confirmWithBiometrics } from '../../lib/biometric';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../theme';
import { useStore } from '../../store/useStore';
import { Screen, Card, ListRow, Eyebrow } from '../../components/Shared';

export function SecuritySettings() {
  const { c } = useTheme();
  const nav = useNavigation<any>();
  const settings = useStore((s) => s.settings);
  const setSettings = useStore((s) => s.setSettings);
  const toggleBio = async (v: boolean) => {
    if (v && !(await biometricAvailable())) {
      Alert.alert('Face ID isn’t set up', 'Set up Face ID in the iPhone’s Settings › Face ID & Passcode, then turn this on.');
      return;
    }
    const ok = await confirmWithBiometrics(v ? 'Turn on Face ID for shell & desktop' : 'Turn off Face ID for shell & desktop');
    if (!ok) return;
    setSettings({ requireBioShellDesktop: v, bioUserSet: true });
  };

  return (
    <Screen>
      <Eyebrow>AUTHENTICATION</Eyebrow>
      <Card>
        <ListRow
          title="Require Face ID for shell & desktop"
          subtitle="Ask for Face ID before opening a remote shell or desktop"
          // The whole row toggles, like iOS Settings — not only the small switch.
          onPress={() => toggleBio(!settings.requireBioShellDesktop)}
          right={
            <Switch
              value={settings.requireBioShellDesktop}
              onValueChange={toggleBio}
              trackColor={{ true: c.accent.base }}
              style={{ transform: [{ scale: 0.8 }] }}
            />
          }
          last
        />
      </Card>

    </Screen>
  );
}
