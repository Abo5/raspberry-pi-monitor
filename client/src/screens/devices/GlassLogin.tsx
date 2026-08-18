// Frosted-glass sign-in shown before entering the remote desktop. Shows the
// endpoint (ip:port) and the connection key, and takes the username/password to
// drive the remote session (RDP-style). Real BlurView needs a native module, so
// the "glass" is layered translucency over the bloom-wave — no extra dependency.
import React, { useState } from 'react';
import {
  KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View, useWindowDimensions,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { useStore } from '../../store/useStore';
import { WaveBackground } from '../../components/WaveBackground';
import { ActionButton } from '../../components/ActionButton';

export function GlassLogin() {
  const { c, type, radius } = useTheme();
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  const agentId = route.params?.agentId as string;
  const agent = useStore((s) => s.agents.find((a) => a.id === agentId));
  const ep = useStore((s) => s.endpoints[agentId]);
  const existing = useStore((s) => s.credentials[agentId]);
  const saveCredentials = useStore((s) => s.saveCredentials);
  const setStore = useStore((s) => s.set);

  const [username, setUsername] = useState(existing?.username ?? agent?.hostname ?? 'pi');
  const [password, setPassword] = useState(existing?.password ?? '');
  const [showPw, setShowPw] = useState(false);
  const [showKey, setShowKey] = useState(false);

  const key = ep?.token ?? '';
  const maskedKey = key ? key.slice(0, 3) + '•'.repeat(Math.max(0, key.length - 6)) + key.slice(-3) : '—';

  const connect = () => {
    if (username.trim().length === 0) return;
    saveCredentials(agentId, username.trim(), password);
    setStore({ currentAgentId: agentId });
    nav.replace('Connect', { agentId });
  };

  // One glassy row (label + value/field).
  const glassField = (
    icon: keyof typeof Ionicons.glyphMap,
    label: string,
    node: React.ReactNode,
  ) => (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)',
        borderRadius: radius.m ?? 14,
        paddingHorizontal: 14,
        height: 54,
        marginBottom: 12,
      }}
    >
      <Ionicons name={icon} size={18} color="rgba(255,255,255,0.6)" />
      <View style={{ flex: 1 }}>
        <Text style={[type.micro, { color: 'rgba(255,255,255,0.5)' }]}>{label}</Text>
        {node}
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: '#08070C' }}>
      <WaveBackground width={width} height={height} variant="violet" />
      {/* Darkening scrim so the glass reads clearly over the bloom */}
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(6,5,10,0.45)' }} />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={{ flex: 1, paddingHorizontal: 22, paddingTop: insets.top + 12 }}>
          <Pressable onPress={() => nav.goBack()} hitSlop={12} style={{ marginBottom: 20 }} accessibilityLabel="Back">
            <Ionicons name="chevron-back" size={26} color="#FFFFFF" />
          </Pressable>

          <View style={{ flex: 1, justifyContent: 'center' }}>
            {/* The glass card */}
            <View
              style={{
                backgroundColor: 'rgba(18,16,26,0.55)',
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.14)',
                borderRadius: 28,
                padding: 22,
                shadowColor: '#000',
                shadowOpacity: 0.4,
                shadowRadius: 30,
                shadowOffset: { width: 0, height: 20 },
              }}
            >
              {/* top highlight line for the glass sheen */}
              <View
                style={{
                  position: 'absolute', top: 0, left: 22, right: 22, height: 1,
                  backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 1,
                }}
              />

              <View style={{ alignItems: 'center', marginBottom: 20 }}>
                <View
                  style={{
                    width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center',
                    backgroundColor: 'rgba(124,92,255,0.22)', borderWidth: 1, borderColor: 'rgba(124,92,255,0.5)',
                  }}
                >
                  <Ionicons name="lock-closed" size={24} color="#B9A6FF" />
                </View>
                <Text style={[type.micro, { color: 'rgba(255,255,255,0.5)', marginTop: 12 }]}>SIGN IN TO</Text>
                <Text style={[type.title1, { color: '#FFFFFF', marginTop: 2 }]}>{agent?.name ?? 'your Pi'}</Text>
              </View>

              {glassField('server-outline', 'Address',
                <Text style={[type.body, { color: '#FFFFFF' }]}>{ep ? `${ep.ip}:${ep.port}` : '—'}</Text>,
              )}

              {glassField('person-outline', 'Username',
                <TextInput
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder="pi"
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  style={[type.body, { color: '#FFFFFF', padding: 0, marginTop: 1 }]}
                />,
              )}

              {glassField('key-outline', 'Password',
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <TextInput
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPw}
                    autoCapitalize="none"
                    autoCorrect={false}
                    placeholder="••••••••"
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    style={[type.body, { color: '#FFFFFF', flex: 1, padding: 0, marginTop: 1 }]}
                  />
                  <Pressable onPress={() => setShowPw((v) => !v)} hitSlop={10}>
                    <Ionicons name={showPw ? 'eye-off-outline' : 'eye-outline'} size={18} color="rgba(255,255,255,0.55)" />
                  </Pressable>
                </View>,
              )}

              {glassField('finger-print-outline', 'Connection key',
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={[type.monoBody, { color: '#FFFFFF', flex: 1 }]} numberOfLines={1}>
                    {showKey ? key || '—' : maskedKey}
                  </Text>
                  <Pressable onPress={() => setShowKey((v) => !v)} hitSlop={10}>
                    <Ionicons name={showKey ? 'eye-off-outline' : 'eye-outline'} size={18} color="rgba(255,255,255,0.55)" />
                  </Pressable>
                </View>,
              )}

              <View style={{ marginTop: 8 }}>
                <ActionButton label="Connect" onPress={connect} disabled={username.trim().length === 0} disabledReason="Enter a username." />
              </View>
            </View>

            <Text style={[type.footnote, { color: 'rgba(255,255,255,0.4)', textAlign: 'center', marginTop: 16 }]}>
              The key is end-to-end encrypted. Only your phone and your Pi can read this session.
            </Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
