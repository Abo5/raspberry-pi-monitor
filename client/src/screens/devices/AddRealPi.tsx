// Connect to a REAL Pi on your network (Track A / LAN MVP). Enter the ip, port,
// and token the Agent printed, we verify by reaching the Agent's /agent
// endpoint, then save it and connect. The Agent QR encodes exactly this
// { ip, port, token }, so scanning fills these in.
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Pressable } from 'react-native';
import { useTheme } from '../../theme';
import { useStore } from '../../store/useStore';
import { WaveBackground } from '../../components/WaveBackground';
import { ActionButton } from '../../components/ActionButton';
import { fetchAgentFacts } from '../../net/localTransport';
import { connectAgent } from '../../net/transport';

export function AddRealPi() {
  const { c, type, radius } = useTheme();
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const prefill = route.params?.endpoint as { ip?: string; port?: string; token?: string } | undefined;

  const [ip, setIp] = useState(prefill?.ip ?? '');
  const [port, setPort] = useState(prefill?.port ?? '8443');
  const [token, setToken] = useState(prefill?.token ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setStore = useStore((s) => s.set);
  const pairAgent = useStore((s) => s.pairAgent);

  const canConnect = ip.trim().length > 0 && port.trim().length > 0 && token.trim().length > 0;

  const connect = async () => {
    if (!canConnect) return;
    setBusy(true);
    setError(null);
    const ep = { ip: ip.trim(), port: port.trim(), token: token.trim() };
    const facts = await fetchAgentFacts(ep);
    setBusy(false);
    if (!facts) {
      setError("Couldn't reach the Agent. Check the Pi is running the Agent and the ip/port/token are right, on the same network.");
      return;
    }
    const id = `local-${ep.ip}-${ep.port}`;
    const now = Date.now();
    const wasPaired = useStore.getState().paired;
    pairAgent({
      id,
      name: facts.name || facts.hostname || ep.ip,
      hostname: facts.hostname || ep.ip,
      model: facts.model || 'Raspberry Pi',
      os: facts.os || 'Raspberry Pi OS',
      agentVersion: facts.agent_version || '—',
      fingerprintHex: '0000000000000000000000000000000000000000000000000000000000000000',
      fingerprintWords: ['local', 'network', 'trusted', 'lan', 'direct', 'pi'],
      pairedAt: now,
      verifiedAt: now,
    });
    setStore({ endpoints: { ...useStore.getState().endpoints, [id]: ep }, currentAgentId: id });
    if (wasPaired) {
      // In-app: go straight into the connect → remote-session flow.
      nav.replace('Connect', { agentId: id });
    } else {
      // First pairing: RootNavigation now switches to the tabs; just connect.
      connectAgent(id);
    }
  };

  const field = (label: string, value: string, onChange: (t: string) => void, keyboard?: 'default' | 'numeric') => (
    <View style={{ marginBottom: 14 }}>
      <Text style={[type.micro, { color: c.text.tertiary, marginBottom: 6 }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType={keyboard === 'numeric' ? 'numbers-and-punctuation' : 'default'}
        placeholder={label}
        placeholderTextColor={c.text.tertiary}
        style={[
          type.body,
          {
            color: c.text.primary,
            backgroundColor: c.surface.raised,
            borderRadius: radius.s,
            borderWidth: 1,
            borderColor: c.border.strong,
            paddingHorizontal: 14,
            height: 48,
          },
        ]}
      />
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: '#000000' }}>
      <WaveBackground width={width} height={height} variant="cyan" dim />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={{ flex: 1, paddingHorizontal: 24, paddingTop: insets.top + 20 }}>
          <Pressable onPress={() => nav.goBack()} hitSlop={12} style={{ marginBottom: 24 }} accessibilityLabel="Back">
            <Ionicons name="chevron-back" size={26} color="#FFFFFF" />
          </Pressable>

          <Text style={[type.title1, { color: '#FFFFFF' }]}>Connect to your Pi</Text>
          <Text style={[type.subhead, { color: c.text.secondary, marginTop: 6, marginBottom: 28 }]}>
            Run the Agent on the Pi; it prints these. Phone and Pi must be on the same network.
          </Text>

          {field('IP address', ip, setIp)}
          {field('Port', port, setPort, 'numeric')}
          {field('Token', token, setToken)}

          {error && (
            <View style={{ backgroundColor: c.surface.raised, borderRadius: radius.s, borderWidth: 1, borderColor: c.border.destructive, padding: 12, marginTop: 4 }}>
              <Text style={[type.subhead, { color: c.status.critical }]}>{error}</Text>
            </View>
          )}
        </View>

        <View style={{ paddingHorizontal: 24, paddingBottom: insets.bottom + 20 }}>
          <ActionButton
            label="Connect"
            onPress={connect}
            loading={busy}
            loadingLabel="Reaching your Pi…"
            disabled={!canConnect}
            disabledReason="Fill in the ip, port, and token."
          />
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
