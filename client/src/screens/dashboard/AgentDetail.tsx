// Agent detail (§6): identity and management of one Agent — the facts that do
// not change minute to minute. Rows that reach the Agent show an offline chip
// instead of a value when the Tunnel is down, never a spinner.
import React, { useState } from 'react';
import { Text } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTheme } from '../../theme';
import { useStore } from '../../store/useStore';
import { Screen, Card, ListRow, Eyebrow } from '../../components/Shared';
import { DestructiveConfirm } from '../../components/DestructiveConfirm';
import { StatusPill } from '../../components/StatusPill';
import { hexGroups } from '../../lib/fingerprint';
import { fmtDuration } from '../../lib/format';

export function AgentDetail() {
  const { c, type } = useTheme();
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const agentId = route.params?.agentId as string | undefined;
  const agent = useStore((s) => s.agents.find((a) => a.id === (agentId ?? s.currentAgentId)));
  const isCurrent = useStore((s) => s.currentAgentId === (agentId ?? s.currentAgentId));
  const connection = useStore((s) => s.connection);
  const snapshot = useStore((s) => s.snapshot);
  const unpairCurrent = useStore((s) => s.unpairCurrent);
  const credentials = useStore((s) => s.credentials);
  const clearCredentials = useStore((s) => s.clearCredentials);
  const [confirmUnpair, setConfirmUnpair] = useState(false);

  if (!agent) return <Screen><Text /></Screen>;

  const savedCreds = credentials[agent.id];

  const connected = isCurrent && connection.kind === 'connected';
  const uptime = snapshot?.values['sys.uptime_s'];

  return (
    <Screen>
      <Eyebrow>IDENTITY</Eyebrow>
      <Card>
        <ListRow title="Name" value={agent.name} />
        <ListRow title="Hostname" value={agent.hostname} />
        <ListRow title="Model" value={agent.model} />
        <ListRow title="OS" value={agent.os} />
        <ListRow title="Agent version" value={agent.agentVersion} />
        <ListRow title="Uptime" value={connected && uptime ? fmtDuration(uptime) : undefined} right={!connected ? <StatusPill status="offline" label="OFFLINE" size="compact" /> : undefined} last />
      </Card>

      <Eyebrow>TRUST</Eyebrow>
      <Card>
        <ListRow
          title="Fingerprint"
          subtitle={hexGroups(agent.fingerprintHex).slice(0, 4).join(' ') + ' …'}
          mono
        />
        <ListRow title="Paired" value={new Date(agent.pairedAt).toDateString()} />
        <ListRow
          title="Verified"
          value={agent.verifiedAt ? new Date(agent.verifiedAt).toDateString() : 'no'}
          last
        />
      </Card>

      <Eyebrow>CONNECTION</Eyebrow>
      <Card>
        <ListRow
          title="Path"
          value={connected && connection.kind === 'connected' ? `${connection.path} · ${connection.rttMs}ms` : undefined}
          right={!connected ? <StatusPill status="offline" label="OFFLINE" size="compact" /> : undefined}
        />
        <ListRow title="Diagnostics" chevron onPress={() => nav.navigate('Diagnostics')} last />
      </Card>

      <Eyebrow>SIGN-IN</Eyebrow>
      <Card>
        {savedCreds ? (
          <>
            <ListRow title="Saved username" value={savedCreds.username} />
            <ListRow
              title="Change sign-in"
              chevron
              onPress={() => nav.navigate('Credentials', { agentId: agent.id })}
            />
            <ListRow title="Forget saved sign-in" destructive onPress={() => clearCredentials(agent.id)} last />
          </>
        ) : (
          <ListRow
            title="Save sign-in for this Pi"
            subtitle="Connect once with credentials to save them"
            chevron
            onPress={() => nav.navigate('Credentials', { agentId: agent.id })}
            last
          />
        )}
      </Card>

      <Eyebrow>STORAGE</Eyebrow>
      <Card>
        <ListRow title="Retention on the Pi" value="90 d raw · 2 y rollups" last />
      </Card>

      <Eyebrow warning>DANGER ZONE</Eyebrow>
      <Card destructive>
        <ListRow title="Unpair this Pi" destructive onPress={() => setConfirmUnpair(true)} last />
      </Card>

      <DestructiveConfirm
        visible={confirmUnpair}
        title={`Unpair ${agent.name}`}
        consequence="This phone will forget the Pi's key and its cached history. The Agent keeps running and keeps recording. To connect again you'd pair from the QR code."
        facts={[
          ['Forgets', 'keys + cached history'],
          ['Keeps', 'the Agent running on the Pi'],
        ]}
        slideLabel="slide to unpair"
        onConfirm={() => {
          setConfirmUnpair(false);
          unpairCurrent();
          nav.popToTop();
        }}
        onCancel={() => setConfirmUnpair(false)}
      />
    </Screen>
  );
}
