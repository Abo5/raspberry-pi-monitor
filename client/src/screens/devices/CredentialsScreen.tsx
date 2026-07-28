// Sign-in prompt shown when connecting to a device with no saved credentials
// (RDP-style). Enter username + password, optionally save them so the app never
// asks again for this Pi, then connect.
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, Switch, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { useStore } from '../../store/useStore';
import { WaveBackground } from '../../components/WaveBackground';
import { ActionButton } from '../../components/ActionButton';

export function CredentialsScreen() {
  const { c, type, radius } = useTheme();
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const agentId = route.params?.agentId as string;
  const agent = useStore((s) => s.agents.find((a) => a.id === agentId));
  const existing = useStore((s) => s.credentials[agentId]);
  const saveCredentials = useStore((s) => s.saveCredentials);
  const clearCredentials = useStore((s) => s.clearCredentials);

  const [username, setUsername] = useState(existing?.username ?? 'pi');
  const [password, setPassword] = useState(existing?.password ?? '');
  const [save, setSave] = useState(true);
  const [showPw, setShowPw] = useState(false);

  const canConnect = username.trim().length > 0;

  const connect = () => {
    if (!canConnect) return;
    if (save) saveCredentials(agentId, username.trim(), password);
    else clearCredentials(agentId);
    nav.replace('Connect', { agentId });
  };

  const field = (
    label: string,
    value: string,
    onChange: (t: string) => void,
    opts: { secure?: boolean; auto?: boolean } = {},
  ) => (
    <View style={{ marginBottom: 14 }}>
      <Text style={[type.micro, { color: c.text.tertiary, marginBottom: 6 }]}>{label}</Text>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: c.surface.raised,
          borderRadius: radius.s,
          borderWidth: 1,
          borderColor: c.border.strong,
          paddingHorizontal: 14,
        }}
      >
        <TextInput
          value={value}
          onChangeText={onChange}
          secureTextEntry={opts.secure && !showPw}
          autoCapitalize={opts.auto ? 'none' : 'none'}
          autoCorrect={false}
          placeholder={label}
          placeholderTextColor={c.text.tertiary}
          style={[type.body, { color: c.text.primary, flex: 1, height: 48 }]}
        />
        {opts.secure && (
          <Pressable onPress={() => setShowPw((v) => !v)} hitSlop={12} accessibilityLabel="Toggle password visibility">
            <Ionicons name={showPw ? 'eye-off-outline' : 'eye-outline'} size={20} color={c.text.tertiary} />
          </Pressable>
        )}
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: '#000000' }}>
      <WaveBackground width={width} height={height} variant="violet" dim />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={{ flex: 1, paddingHorizontal: 24, paddingTop: insets.top + 20 }}>
          <Pressable onPress={() => nav.goBack()} hitSlop={12} style={{ marginBottom: 24 }} accessibilityLabel="Back">
            <Ionicons name="chevron-back" size={26} color="#FFFFFF" />
          </Pressable>

          <Text style={[type.micro, { color: c.text.tertiary }]}>SIGN IN TO</Text>
          <Text style={[type.title1, { color: '#FFFFFF', marginTop: 4 }]}>{agent?.name ?? 'this Pi'}</Text>
          <Text style={[type.subhead, { color: c.text.secondary, marginTop: 4, marginBottom: 28 }]}>
            {agent?.hostname ?? ''}.local
          </Text>

          {field('Username', username, setUsername, { auto: true })}
          {field('Password', password, setPassword, { secure: true })}

          <Pressable
            onPress={() => setSave((v) => !v)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: c.surface.raised,
              borderRadius: radius.s,
              borderWidth: 1,
              borderColor: c.border.subtle,
              paddingHorizontal: 14,
              paddingVertical: 12,
              marginTop: 4,
            }}
          >
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={[type.body, { color: c.text.primary }]}>Save credentials</Text>
              <Text style={[type.footnote, { color: c.text.tertiary, marginTop: 2 }]}>
                Don't ask again — connect straight to {agent?.name ?? 'this Pi'} next time.
              </Text>
            </View>
            <Switch
              value={save}
              onValueChange={setSave}
              trackColor={{ true: c.accent.base }}
            />
          </Pressable>
        </View>

        <View style={{ paddingHorizontal: 24, paddingBottom: insets.bottom + 20 }}>
          <ActionButton
            label="Connect"
            onPress={connect}
            disabled={!canConnect}
            disabledReason="Enter a username to connect."
          />
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
