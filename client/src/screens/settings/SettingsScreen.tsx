// Settings (§14). Groups link to dedicated sub-screens.
import React from 'react';
import { useNavigation } from '@react-navigation/native';
import { useStore } from '../../store/useStore';
import { Screen, Card, ListRow, Eyebrow } from '../../components/Shared';

export function SettingsScreen() {
  const nav = useNavigation<any>();
  const agent = useStore((s) => s.agents.find((a) => a.id === s.currentAgentId));
  const settings = useStore((s) => s.settings);

  return (
    <Screen>
      <Eyebrow>CONFIGURE</Eyebrow>
      <Card>
        <ListRow title="Security" icon="lock-closed" iconBg="#5B5BD6" chevron onPress={() => nav.navigate('SecuritySettings')} />
        <ListRow title="Appearance" icon="contrast" iconBg="#0B84CE" value={settings.theme} chevron onPress={() => nav.navigate('AppearanceSettings')} />
        <ListRow title="Data & retention" icon="server" iconBg="#8E5B2F" chevron onPress={() => nav.navigate('DataSettings')} />
        <ListRow title="Widgets" icon="grid" iconBg="#7C3AED" chevron onPress={() => nav.navigate('WidgetsTab' as never)} last />
      </Card>

      <Eyebrow>SUPPORT AND DIAGNOSTICS</Eyebrow>
      <Card>
        <ListRow title="Connection inspector" icon="pulse" iconBg="#0F7A5B" chevron onPress={() => nav.navigate('Diagnostics')} />
        <ListRow title="Security log" icon="document-text" iconBg="#946200" chevron onPress={() => nav.navigate('SecurityLog')} last />
      </Card>

      <Eyebrow>ABOUT</Eyebrow>
      <Card>
        <ListRow title="App version" value="0.1.0 (M2 preview)" />
        <ListRow title="Agent version" value={agent?.agentVersion ?? '—'} />
        <ListRow title="Protocol version" value="1" last />
      </Card>
    </Screen>
  );
}
