// Settings (§14). The Raspberry Pi Connect account (with sign-out), then the
// configuration sub-screens, then the app version.
import React from 'react';
import { Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { connectLive, useStore } from '../../store/useStore';
import { Screen, Card, ListRow, Eyebrow } from '../../components/Shared';
import { signOutOfConnect } from '../../net/connectCookies';

export function SettingsScreen() {
  const nav = useNavigation<any>();
  const settings = useStore((s) => s.settings);
  const signedIn = useStore(connectLive);
  const email = useStore((s) => s.connectEmail);

  const confirmSignOut = () =>
    Alert.alert(
      'Sign out of Raspberry Pi Connect?',
      'Your devices will disappear from the app until you sign in again.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign out', style: 'destructive', onPress: () => { signOutOfConnect(); } },
      ],
    );

  return (
    <Screen title="Settings">
      <Eyebrow>RASPBERRY PI ACCOUNT</Eyebrow>
      <Card>
        {signedIn ? (
          <>
            <ListRow title="Raspberry Pi Connect" subtitle={email ?? 'Signed in'} icon="cloud" iconBg="#C51A4A" />
            <ListRow title="Sign out" icon="log-out-outline" destructive onPress={confirmSignOut} last />
          </>
        ) : (
          <ListRow title="Sign in to Raspberry Pi Connect" icon="cloud" iconBg="#C51A4A" chevron onPress={() => nav.navigate('DevicesTab', { screen: 'ConnectLogin' })} last />
        )}
      </Card>

      <Eyebrow>CONFIGURE</Eyebrow>
      <Card>
        <ListRow title="Security" icon="lock-closed" iconBg="#5B5BD6" chevron onPress={() => nav.navigate('SecuritySettings')} />
        <ListRow title="Appearance" icon="contrast" iconBg="#0B84CE" value={settings.theme} chevron onPress={() => nav.navigate('AppearanceSettings')} />
        <ListRow title="Data & retention" icon="server" iconBg="#8E5B2F" chevron onPress={() => nav.navigate('DataSettings')} last />
      </Card>

      <Eyebrow>ABOUT</Eyebrow>
      <Card>
        <ListRow title="App version" value="0.1.0" last />
      </Card>
    </Screen>
  );
}
