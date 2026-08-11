// Remote Shell (§11). TerminalSurface is always dark in both appearances.
//
// Bytes flow over the Agent's WS /shell (a genuine PTY). Output is streamed;
// input is sent raw and the PTY echoes it. ANSI escape sequences are stripped
// for a simple, readable renderer (full xterm emulation is a later polish).
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View,
} from 'react-native';
import { useTheme } from '../../theme';
import { type as t, mono } from '../../theme/typography';
import { useStore } from '../../store/useStore';
import { dark } from '../../theme/colors';
import { openLocalShell } from '../../net/localTransport';
import { EmptyState } from '../../components/States';

// Strip common ANSI/OSC escape sequences and bare CRs for the simple renderer.
function stripAnsi(s: string): string {
  return s
    // eslint-disable-next-line no-control-regex
    .replace(/\x1b\][0-9];[^\x07\x1b]*(\x07|\x1b\\)/g, '') // OSC (title etc.)
    // eslint-disable-next-line no-control-regex
    .replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, '') // CSI
    // eslint-disable-next-line no-control-regex
    .replace(/\x1b[=>()][A-Za-z0-9]?/g, '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00\x07\x08]/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '');
}

export function ShellScreen() {
  const { c } = useTheme();
  const term = dark.terminal;
  const agentId = useStore((s) => s.currentAgentId);
  const endpoint = useStore((s) => (agentId ? s.endpoints[agentId] : undefined));

  const fontSize = useStore((s) => s.settings.terminalFontSize);
  const [input, setInput] = useState('');
  const inputRef = useRef<TextInput>(null);
  const scrollRef = useRef<ScrollView>(null);
  const setStore = useStore((s) => s.set);

  const [text, setText] = useState('');
  const shellRef = useRef<ReturnType<typeof openLocalShell> | null>(null);

  useEffect(() => {
    if (!endpoint) return undefined;
    setText(`Connecting to ${endpoint.ip}…\n`);
    const handle = openLocalShell(endpoint, {
      onData: (chunk) => setText((prev) => (prev + stripAnsi(chunk)).slice(-40000)),
      onClose: () => setText((prev) => prev + '\n[shell disconnected]\n'),
    });
    shellRef.current = handle;
    // best-effort initial resize
    handle.resize(96, 30);
    setStore({ shellSessionStartedAt: Date.now() });
    setTimeout(() => inputRef.current?.focus(), 400);
    return () => {
      handle.close();
      shellRef.current = null;
    };
  }, [endpoint?.ip, endpoint?.port]);

  const lines = useMemo(() => text.split('\n'), [text]);

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: false });
  }, [lines.length, text]);

  if (!endpoint) {
    return (
      <View style={{ flex: 1, backgroundColor: term.ground, justifyContent: 'center' }}>
        <EmptyState
          icon="terminal-outline"
          title="No shell without a Pi"
          body="This Pi has no saved endpoint. Re-pair it to open a real shell."
        />
      </View>
    );
  }

  const submit = () => {
    const cmd = input;
    setInput('');
    shellRef.current?.send(cmd + '\n'); // PTY echoes it back
  };

  const sendKey = (k: string) => {
    const map: Record<string, string> = { '^C': '\x03', '⎋': '\x1b', '⇥': '\t' };
    shellRef.current?.send(map[k] ?? k);
    inputRef.current?.focus();
  };

  const lineStyle = { fontFamily: mono, fontSize, lineHeight: Math.round(fontSize * 1.3), color: term.ansi[7] };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: term.ground }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 8, paddingTop: 4 }}>
        {lines.map((line, i) => (
          <Text key={i} style={lineStyle}>
            {line}
          </Text>
        ))}
        {/* local input echo (shows what you're typing) */}
        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
          <Text style={lineStyle}>{input}</Text>
          <View style={{ width: Math.max(6, fontSize * 0.55), height: fontSize + 2, backgroundColor: term.cursor, marginLeft: 1 }} />
        </View>
        <TextInput
          ref={inputRef}
          value={input}
          onChangeText={setInput}
          onSubmitEditing={submit}
          blurOnSubmit={false}
          autoCapitalize="none"
          autoCorrect={false}
          style={{ position: 'absolute', opacity: 0, height: 1, width: 1 }}
        />
        <Pressable style={{ height: 200 }} onPress={() => inputRef.current?.focus()} />
      </ScrollView>

      {/* Keyboard accessory bar (§11.2) */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="always"
        style={{ maxHeight: 44, backgroundColor: c.surface.raised2, borderTopWidth: 1, borderTopColor: c.border.hairline }}
        contentContainerStyle={{ paddingHorizontal: 8, paddingVertical: 4, gap: 6 }}
      >
        {['⎋', '⇥', '^C', '|', '~', '/', '-', '_', 'sudo ', 'clear'].map((k) => (
          <Pressable
            key={k}
            onPress={() => sendKey(k)}
            hitSlop={6}
            style={({ pressed }) => ({
              minWidth: 44,
              height: 36,
              paddingHorizontal: 10,
              borderRadius: 8,
              backgroundColor: pressed ? c.surface.overlay : c.surface.raised,
              borderWidth: 1,
              borderColor: c.border.subtle,
              alignItems: 'center',
              justifyContent: 'center',
            })}
          >
            <Text style={[t.monoBody, { color: c.text.primary }]}>{k.trim()}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
