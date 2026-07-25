// Settings (§14). Groups link to dedicated sub-screens; every destructive row
// lives in a Danger zone group with border.destructive.
import React, { useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { useStore } from '../../store/useStore';
import { Screen, Card, ListRow, Eyebrow } from '../../components/Shared';
import { DestructiveConfirm } from '../../components/DestructiveConfirm';
import { StatusPill } from '../../components/StatusPill';

export function SettingsScreen() {
  const nav = useNavigation<any>();
  const agent = useStore((s) => s.agents.find((a) => a.id === s.currentAgentId));
  const connection = useStore((s) => s.connection);
  const settings = useStore((s) => s.settings);
  const unpairCurrent = useStore((s) => s.unpairCurrent);
  const [confirmUnpair, setConfirmUnpair] = useState(false);

  return (
    <Screen>
      <Eyebrow>PIS</Eyebrow>
      <Card>
        <ListRow
          title={agent?.name ?? '—'}
          right={
            <StatusPill
              status={connection.kind === 'connected' ? 'ok' : connection.kind === 'offline' ? 'offline' : 'unknown'}
              label={connection.kind === 'connected' ? 'ONLINE' : connection.kind === 'offline' ? 'OFFLINE' : '—'}
              size="compact"
              style={{ marginRight: 6 }}
            />
          }
          chevron
          onPress={() => nav.navigate('AgentDetail', { agentId: agent?.id })}
        />
        <ListRow title="All Pis" chevron onPress={() => nav.navigate('AgentList')} />
        <ListRow title="Pair another Pi" chevron onPress={() => nav.navigate('ScanQR')} last />
      </Card>

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

      <Eyebrow warning>DANGER ZONE</Eyebrow>
      <Card destructive>
        <ListRow title="Unpair this Pi" destructive onPress={() => setConfirmUnpair(true)} last />
      </Card>

      <DestructiveConfirm
        visible={confirmUnpair}
        title={`Unpair ${agent?.name ?? ''}`}
        consequence="This phone will forget the Pi's key and its cached history. The Agent keeps running and keeps recording. To connect again you'd pair from the QR code."
        facts={[
          ['Forgets', 'keys + cached history'],
          ['Keeps', 'the Agent running on the Pi'],
        ]}
        slideLabel="slide to unpair"
        onConfirm={() => {
          setConfirmUnpair(false);
          unpairCurrent();
        }}
        onCancel={() => setConfirmUnpair(false)}
      />
    </Screen>
  );
}
