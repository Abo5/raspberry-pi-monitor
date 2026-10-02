// Set up (or change) monitoring over SSH: the Pi's address and the user's own
// SSH login. We test the login before saving; the password goes to the Keychain
// and the Pi's host key is remembered so a different machine can't pose as it.
import React, { useState } from 'react';
import {
  ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { useStore } from '../../store/useStore';
import { GlassBackground } from '../../components/Glass';
import { connectAgent, disconnectAgent } from '../../net/transport';
import { SshConnectError, removeSshMonitor, savePassword, testSshLogin } from '../../net/sshMonitor';
import { latinDigits } from '../../lib/latinDigits';

const ERRORS: Record<SshConnectError, string> = {
  auth: 'The Pi rejected the username or password.',
  hostKeyChanged: 'The Pi’s identity changed. Remove it and add it again.',
  unreachable: 'Couldn’t reach the Pi. Check the address, that your phone is on the same network (or on Tailscale), and that Local Network is on for this app in Settings › Privacy & Security › Local Network.',
  unavailable: 'SSH isn’t available in this build of the app.',
};

export function SshMonitorSetup() {
  const { c, type } = useTheme();
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const existing = useStore((s) => s.sshMonitor);
  const set = useStore((s) => s.set);

  const [host, setHost] = useState(existing?.host ?? '');
  const [port, setPort] = useState(String(existing?.port ?? 22));
  const [username, setUsername] = useState(existing?.username ?? '');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = host.trim() && username.trim() && password && Number(port) > 0 && !busy;

  const submit = async () => {
    setBusy(true);
    setError(null);
    const h = latinDigits(host).trim();
    const p = Number(latinDigits(port)) || 22;
    const u = username.trim();
    const res = await testSshLogin(h, p, u, password);
    if (!res.ok) {
      setBusy(false);
      setError(ERRORS[res.error]);
      return;
    }
    await savePassword(password);
    disconnectAgent();
    set({ sshMonitor: { host: h, port: p, username: u, hostKey: res.hostKey || null, name: res.name } });
    connectAgent(null);
    setBusy(false);
    nav.goBack();
  };

  const remove = () => {
    Alert.alert('Stop monitoring this Pi?', 'The saved address and password are removed from this iPhone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          await removeSshMonitor();
          nav.goBack();
        },
      },
    ]);
  };

  const field = (
    label: string, value: string, onChange: (t: string) => void,
    opts: { placeholder?: string; secure?: boolean; numeric?: boolean } = {},
  ) => (
    <View style={{ marginTop: 14 }}>
      <Text style={[type.micro, { color: c.text.tertiary, marginBottom: 6 }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={opts.placeholder}
        placeholderTextColor="rgba(255,255,255,0.3)"
        secureTextEntry={opts.secure}
        keyboardType={opts.numeric ? 'number-pad' : Platform.OS === 'ios' ? 'url' : 'default'}
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
        textContentType={opts.secure ? 'password' : 'none'}
        style={{
          height: 48, borderRadius: 12, paddingHorizontal: 14, color: '#FFFFFF', fontSize: 16,
          backgroundColor: 'rgba(0,0,0,0.35)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
        }}
      />
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <GlassBackground base="#000000" strength={0.9} />
        <ScrollView
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
          keyboardDismissMode="interactive"
          contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 16, paddingBottom: insets.bottom + 32 }}
        >
          <Pressable onPress={() => nav.goBack()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close"
            style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.08)' }}
          >
            <Ionicons name="close" size={20} color="#EDEDF0" />
          </Pressable>

          <Text style={[type.display, { color: '#FFFFFF', fontSize: 30, marginTop: 18 }]}>Monitor over SSH</Text>
          <Text style={[type.subhead, { color: c.text.secondary, marginTop: 6 }]}>
            Sign in to your Pi with its SSH account. The app reads CPU, temperature, memory, disk and network every few seconds — nothing to install on the Pi.
          </Text>

          <View style={{ marginTop: 18, borderRadius: 22, overflow: 'hidden', padding: 18, paddingTop: 4, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: 'rgba(255,255,255,0.05)' }}>
            <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
            {field('ADDRESS', host, (t) => setHost(latinDigits(t)), { placeholder: '192.168.1.42 or kali.local' })}
            {field('PORT', port, (t) => setPort(latinDigits(t)), { numeric: true })}
            {field('USERNAME', username, setUsername, { placeholder: 'kali' })}
            {field('PASSWORD', password, setPassword, { secure: true, placeholder: existing ? 'Enter again to change' : '' })}

            {!!error && (
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
                <Ionicons name="alert-circle" size={18} color="#FF8A8A" />
                <Text style={[type.subhead, { color: '#FF8A8A', flex: 1 }]}>{error}</Text>
              </View>
            )}

            <Pressable
              onPress={submit}
              disabled={!canSubmit}
              accessibilityRole="button"
              style={({ pressed }) => ({
                marginTop: 20, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center',
                flexDirection: 'row', gap: 8,
                backgroundColor: pressed ? '#7A5BDA' : '#8A6BEA', opacity: canSubmit ? 1 : 0.45,
              })}
            >
              {busy ? <ActivityIndicator color="#FFFFFF" /> : <Ionicons name="pulse" size={18} color="#FFFFFF" />}
              <Text style={[type.bodyEmph, { color: '#FFFFFF' }]}>{busy ? 'Connecting…' : 'Start monitoring'}</Text>
            </Pressable>
          </View>

          <Text style={[type.caption, { color: c.text.tertiary, marginTop: 14 }]}>
            Away from home? Install Tailscale on your Pi and iPhone and use the Pi’s Tailscale address here.
          </Text>

          {!!existing && (
            <Pressable onPress={remove} accessibilityRole="button" style={{ marginTop: 24, alignSelf: 'center', padding: 10 }}>
              <Text style={[type.bodyEmph, { color: '#FF6B6B' }]}>Stop monitoring this Pi</Text>
            </Pressable>
          )}
        </ScrollView>
    </View>
  );
}
