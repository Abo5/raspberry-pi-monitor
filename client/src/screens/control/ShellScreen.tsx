// Remote Shell (§11). TerminalSurface is always dark in both appearances
// (§2.2 exception). Scrollback is never cleared by an error — only explicitly.
// The PTY here is simulated; canned responses read the live simulated metrics
// so `vcgencmd measure_temp` agrees with the Dashboard.
import React, { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View,
} from 'react-native';
import { useTheme } from '../../theme';
import { type as t, mono } from '../../theme/typography';
import { useStore } from '../../store/useStore';
import { dark } from '../../theme/colors';
import { metricValue } from '../../sim/metrics';
import { fmtTemp } from '../../lib/format';

const PROMPT = 'pi@pi5-livingroom:~ $';

function respond(cmd: string): string[] {
  const now = Date.now();
  const c = cmd.trim();
  if (c === '') return [];
  if (c === 'vcgencmd measure_temp') return [`temp=${fmtTemp(metricValue('cpu.temp_c', now))}'C`];
  if (c === 'uptime') {
    return [
      ` ${new Date().toTimeString().slice(0, 8)} up 14 days,  2 users,  load average: ${metricValue('load.1m', now).toFixed(2)}, ${(metricValue('load.1m', now) * 0.9).toFixed(2)}, ${(metricValue('load.1m', now) * 0.8).toFixed(2)}`,
    ];
  }
  if (c === 'uname -a')
    return ['Linux pi5-livingroom 6.12.20-v8-16k+ #1 SMP PREEMPT aarch64 GNU/Linux'];
  if (c === 'free -h') {
    const used = metricValue('mem.used_pct', now) / 100;
    return [
      '               total        used        free      shared  buff/cache   available',
      `Mem:           7.9Gi       ${(used * 7.9).toFixed(1)}Gi       ${((1 - used) * 5).toFixed(1)}Gi       120Mi       2.6Gi       ${((1 - used) * 7.9).toFixed(1)}Gi`,
      'Swap:          511Mi          0B       511Mi',
    ];
  }
  if (c === 'df -h' || c === 'df -h /') {
    const used = Math.round(metricValue('disk.used_pct', now));
    return [
      'Filesystem      Size  Used Avail Use% Mounted on',
      `/dev/mmcblk0p2  118G   ${Math.round(1.18 * used)}G   ${Math.round(1.18 * (100 - used))}G  ${used}% /`,
    ];
  }
  if (c === 'ls')
    return ['Bookshelf  Desktop  Documents  Downloads  Music  Pictures  Public  Videos'];
  if (c.startsWith('sudo')) return [`sudo: this demo shell runs unprivileged`];
  if (c === 'help')
    return ['Demo PTY. Try: vcgencmd measure_temp · uptime · free -h · df -h · uname -a · ls · clear'];
  return [`bash: ${c.split(' ')[0]}: command not found`];
}

export function ShellScreen() {
  const { c } = useTheme();
  const term = dark.terminal; // always dark
  const buffer = useStore((s) => s.shellBuffer);
  const appendShell = useStore((s) => s.appendShell);
  const setStore = useStore((s) => s.set);
  const fontSize = useStore((s) => s.settings.terminalFontSize);
  const [input, setInput] = useState('');
  const inputRef = useRef<TextInput>(null);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (!useStore.getState().shellSessionStartedAt) {
      setStore({ shellSessionStartedAt: Date.now() });
      if (buffer.length === 0) {
        appendShell([
          'Linux pi5-livingroom 6.12.20-v8-16k+ aarch64',
          `Last login: ${new Date().toUTCString()}`,
          "Type 'help' for demo commands.",
        ]);
      }
    }
    setTimeout(() => inputRef.current?.focus(), 400);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: false });
  }, [buffer.length]);

  const submit = () => {
    const cmd = input;
    setInput('');
    if (cmd.trim() === 'clear') {
      setStore({ shellBuffer: [] });
      return;
    }
    appendShell([`${PROMPT} ${cmd}`, ...respond(cmd)]);
  };

  const sendKey = (k: string) => {
    if (k === '^C') {
      appendShell([`${PROMPT} ${input}^C`]);
      setInput('');
    } else if (k === 'TAB') {
      // completion not simulated
    } else {
      setInput((s) => s + k);
    }
    inputRef.current?.focus();
  };

  const lineStyle = {
    fontFamily: mono,
    fontSize,
    lineHeight: Math.round(fontSize * 1.3),
    color: term.ansi[7],
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: term.ground }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 8, paddingTop: 4 }}
      >
        {buffer.map((line, i) => (
          <Text key={i} style={lineStyle}>
            {line}
          </Text>
        ))}
        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
          <Text style={[lineStyle, { color: term.ansi[10] }]}>{PROMPT} </Text>
          <Text style={lineStyle}>{input}</Text>
          <View
            style={{
              width: Math.max(6, fontSize * 0.55),
              height: fontSize + 2,
              backgroundColor: term.cursor,
              marginLeft: 1,
            }}
          />
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
            onPress={() => (k === '⎋' || k === '⇥' ? undefined : k === 'clear' ? (setInput('clear'), submit()) : sendKey(k))}
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
