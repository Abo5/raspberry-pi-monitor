// Settings (§14). Every destructive row lives in a Danger zone group with
// border.destructive.
import React, { useState } from 'react';
import { Switch, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../theme';
import { useStore } from '../../store/useStore';
import { Screen, Card, ListRow, Eyebrow } from '../../components/Shared';
import { DestructiveConfirm } from '../../components/DestructiveConfirm';
import { StatusPill } from '../../components/StatusPill';

export function SettingsScreen() {
  const { c, type } = useTheme();
  const nav = useNavigation<any>();
  const agent = useStore((s) => s.agents.find((a) => a.id === s.currentAgentId));
  const connection = useStore((s) => s.connection);
  const settings = useStore((s) => s.settings);
  const setSettings = useStore((s) => s.setSettings);
  const unpairCurrent = useStore((s) => s.unpairCurrent);
  const [confirmUnpair, setConfirmUnpair] = useState(false);

  const themeLabel = { system: 'System', dark: 'Dark', light: 'Light' }[settings.theme];
  const cycleTheme = () => {
    const order = ['system', 'dark', 'light'] as const;
    setSettings({ theme: order[(order.indexOf(settings.theme) + 1) % 3] });
  };

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
          onPress={() => nav.navigate('AgentList')}
        />
        <ListRow title="Pair another Pi" chevron onPress={() => nav.navigate('ScanQR')} last />
      </Card>

      <Eyebrow>SECURITY</Eyebrow>
      <Card>
        <ListRow
          title="Require Face ID for shell & desktop"
          right={
            <Switch
              value={settings.requireBioShellDesktop}
              onValueChange={(v) => setSettings({ requireBioShellDesktop: v })}
              trackColor={{ true: c.accent.base }}
              style={{ transform: [{ scale: 0.8 }] }}
            />
          }
        />
        <ListRow title="Devices & keys" chevron onPress={() => nav.navigate('DevicesKeys')} last />
      </Card>

      <Eyebrow>APPEARANCE</Eyebrow>
      <Card>
        <ListRow title="Theme" value={themeLabel} onPress={cycleTheme} />
        <ListRow
          title="Terminal font size"
          value={`${settings.terminalFontSize}pt`}
          onPress={() =>
            setSettings({ terminalFontSize: settings.terminalFontSize >= 20 ? 9 : settings.terminalFontSize + 1 })
          }
        />
        <ListRow
          title="Animate chart updates"
          right={
            <Switch
              value={settings.animateCharts}
              onValueChange={(v) => setSettings({ animateCharts: v })}
              trackColor={{ true: c.accent.base }}
              style={{ transform: [{ scale: 0.8 }] }}
            />
          }
          last
        />
      </Card>

      <Eyebrow>DATA</Eyebrow>
      <Card>
        <ListRow
          title="Telemetry interval"
          value={`${settings.telemetryIntervalS}s`}
          onPress={() => {
            const order = [1, 5, 15, 60];
            const next = order[(order.indexOf(settings.telemetryIntervalS) + 1) % order.length];
            setSettings({ telemetryIntervalS: next });
          }}
        />
        <ListRow title="Retention on the Pi" value="90 d raw · 2 y rollups" last />
      </Card>

      <Eyebrow>DIAGNOSTICS</Eyebrow>
      <Card>
        <ListRow title="Connection inspector" chevron onPress={() => nav.navigate('Diagnostics')} last />
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
