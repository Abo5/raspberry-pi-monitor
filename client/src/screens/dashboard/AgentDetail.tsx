// Agent detail (§6): identity and management of one Agent — the facts that do
// not change minute to minute. Rows that reach the Agent show an offline chip
// instead of a value when the Tunnel is down, never a spinner.
import React, { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { useStore } from '../../store/useStore';
import { Screen, Card, ListRow, Eyebrow } from '../../components/Shared';
import { DestructiveConfirm } from '../../components/DestructiveConfirm';
import { StatusPill } from '../../components/StatusPill';
import { ActionButton } from '../../components/ActionButton';
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
  const endpoint = useStore((s) => s.endpoints[agentId ?? s.currentAgentId ?? '']);
  const setStore = useStore((s) => s.set);
  const saveCredentials = useStore((s) => s.saveCredentials);
  const [confirmUnpair, setConfirmUnpair] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [showKey, setShowKey] = useState(false);

  const id = agentId ?? '';
  const savedCreds = useStore((s) => s.credentials[id]);
  // Editable copies of the connection details.
  const [ip, setIp] = useState(endpoint?.ip ?? '');
  const [port, setPort] = useState(endpoint?.port ?? '');
  const [username, setUsername] = useState(savedCreds?.username ?? agent?.hostname ?? 'pi');
  const [password, setPassword] = useState(savedCreds?.password ?? '');
  const [token, setToken] = useState(endpoint?.token ?? '');

  if (!agent) return <Screen><Text /></Screen>;

  const dirty =
    ip !== (endpoint?.ip ?? '') ||
    port !== (endpoint?.port ?? '') ||
    token !== (endpoint?.token ?? '') ||
    username !== (savedCreds?.username ?? agent.hostname) ||
    password !== (savedCreds?.password ?? '');

  const save = () => {
    setStore({ endpoints: { ...useStore.getState().endpoints, [agent.id]: { ip: ip.trim(), port: port.trim(), token: token.trim() } } });
    saveCredentials(agent.id, username.trim(), password);
  };

  const connected = isCurrent && connection.kind === 'connected';
  const uptime = snapshot?.values['sys.uptime_s'];

  // An editable detail row. Long-press selects to copy; secrets get an eye.
  const EditRow = ({
    label, value, onChange, secret, shown, onToggle, keyboard, last,
  }: {
    label: string; value: string; onChange: (t: string) => void;
    secret?: boolean; shown?: boolean; onToggle?: () => void;
    keyboard?: 'numeric'; last?: boolean;
  }) => (
    <View
      style={{
        flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 6,
        borderBottomWidth: last ? 0 : 1, borderBottomColor: c.border.hairline,
      }}
    >
      <Text style={[type.micro, { color: c.text.tertiary, width: 96 }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        secureTextEntry={secret && !shown}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType={keyboard === 'numeric' ? 'numbers-and-punctuation' : 'default'}
        placeholder="—"
        placeholderTextColor={c.text.tertiary}
        style={[type.monoBody, { color: c.text.primary, flex: 1, paddingVertical: 8 }]}
      />
      {secret && (
        <Pressable onPress={onToggle} hitSlop={10} accessibilityLabel={`Toggle ${label}`}>
          <Ionicons name={shown ? 'eye-off-outline' : 'eye-outline'} size={18} color={c.text.tertiary} />
        </Pressable>
      )}
    </View>
  );

  return (
    <Screen>
      <Eyebrow>ACCESS DETAILS</Eyebrow>
      <Card>
        <EditRow label="IP address" value={ip} onChange={setIp} />
        <EditRow label="Port" value={port} onChange={setPort} keyboard="numeric" />
        <EditRow label="Username" value={username} onChange={setUsername} />
        <EditRow label="Password" value={password} onChange={setPassword} secret shown={showPw} onToggle={() => setShowPw((v) => !v)} />
        <EditRow label="Key" value={token} onChange={setToken} secret shown={showKey} onToggle={() => setShowKey((v) => !v)} last />
      </Card>
      {dirty ? (
        <View style={{ marginTop: 10, marginBottom: 4 }}>
          <ActionButton label="Save changes" onPress={save} />
        </View>
      ) : (
        <Text style={[type.footnote, { color: c.text.tertiary, marginTop: 6, marginBottom: 4 }]}>
          Long-press any value to copy it. Edit a field to enable Save.
        </Text>
      )}

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
