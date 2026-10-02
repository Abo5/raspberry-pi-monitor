// Live Commands — an automatic monitor that runs shell commands on the Pi and
// shows the output, refreshed on a timer. Defaults cover the useful stuff; the
// user can add/remove their own commands.
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useStore } from '../../store/useStore';
import { type as t, mono } from '../../theme/typography';
import { dark } from '../../theme/colors';
import { execRemote } from '../../net/localTransport';
import { sshExec } from '../../net/sshMonitor';
import { EmptyState } from '../../components/States';

interface Cmd {
  id: string;
  name: string;
  command: string;
}

type CmdResult = { output: string; ok: boolean; at: number } | null;

const DEFAULTS: Cmd[] = [
  { id: 'temp', name: 'Temperature', command: 'vcgencmd measure_temp' },
  { id: 'load', name: 'Load / Uptime', command: 'uptime' },
  { id: 'mem', name: 'Memory', command: 'free -h' },
  { id: 'disk', name: 'Disk', command: 'df -h /' },
  { id: 'net', name: 'Network', command: 'ip -brief address show' },
  { id: 'procs', name: 'Top processes', command: 'ps -eo pid,pcpu,pmem,comm --sort=-pcpu | head -8' },
];

const INTERVAL_MS = 8000;

export function LiveCommandsScreen() {
  const term = dark.terminal;
  const agentId = useStore((s) => s.currentAgentId);
  const endpoint = useStore((s) => (agentId ? s.endpoints[agentId] : undefined));
  const agent = useStore((s) => s.agents.find((a) => a.id === agentId));
  const connected = useStore((s) => s.connection.kind === 'connected');
  const viaSsh = useStore((s) => !!s.sshMonitor || !!s.connectMonitorName);

  const [cmds, setCmds] = useState<Cmd[]>(DEFAULTS);
  const [results, setResults] = useState<Record<string, CmdResult>>({});
  const [running, setRunning] = useState(false);
  const [auto, setAuto] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCommand, setNewCommand] = useState('');

  const runAll = useCallback(async () => {
    setRunning(true);
    const next: Record<string, CmdResult> = {};
    // Sequential — keeps the Pi load gentle and avoids hammering the shell.
    for (const cmd of cmds) {
      let output: string;
      let ok = false;
      if (viaSsh) {
        // Over the Monitor's SSH session, or Connect's remote shell.
        const r = await sshExec(cmd.command);
        output = r === null ? 'unreachable' : r.output.trim() || (r.exitCode === 0 ? '(no output)' : 'error');
        ok = r !== null && r.exitCode === 0;
        next[cmd.id] = { output, ok, at: Date.now() };
        continue;
      }
      if (!endpoint) break;
      const r = await execRemote(endpoint, cmd.command, INTERVAL_MS - 500);
      if (r === 'old-agent') {
        output = 'Update the agent on your Pi — it is missing the /exec endpoint. Re-run install.sh on the Pi.';
      } else if (r === null) {
        output = 'unreachable';
      } else {
        output = `${r.stdout}${r.stderr ? (r.stdout ? '\n' : '') + r.stderr : ''}`.trim() || (r.ok ? '(no output)' : 'error');
        ok = r.ok;
      }
      next[cmd.id] = { output, ok, at: Date.now() };
    }
    setResults(next);
    setRunning(false);
  }, [cmds, viaSsh, endpoint]);

  useEffect(() => {
    if ((!endpoint && !viaSsh) || !connected) return;
    runAll();
    if (!auto) return;
    const timer = setInterval(() => runAll(), INTERVAL_MS);
    return () => clearInterval(timer);
  }, [viaSsh, endpoint?.ip, endpoint?.port, connected, auto, runAll]);

  if (!endpoint && !viaSsh) {
    return (
      <View style={{ flex: 1, backgroundColor: term.ground, justifyContent: 'center' }}>
        <EmptyState
          icon="terminal-outline"
          title="No Pi to command"
          body="Connect Monitor over SSH first, then run live commands here."
        />
      </View>
    );
  }

  const add = () => {
    const name = newName.trim();
    const command = newCommand.trim();
    if (!name || !command) return;
    setCmds((prev) => [...prev, { id: `c-${Date.now()}`, name, command }]);
    setNewName('');
    setNewCommand('');
    setAdding(false);
  };

  const btn = (label: string, onPress: () => void, accent = false) => (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => ({
        height: 34,
        paddingHorizontal: 12,
        borderRadius: 17,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: accent ? (pressed ? '#7A5BDA' : '#8A6BEA') : pressed ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.08)',
        borderWidth: accent ? 0 : 1,
        borderColor: 'rgba(255,255,255,0.12)',
      })}
    >
      <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );

  const inputStyle = {
    height: 40,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    color: '#FFFFFF',
    fontFamily: mono,
    fontSize: 13,
  } as const;

  return (
    <View style={{ flex: 1, backgroundColor: term.ground }}>
      {/* Toolbar */}
      <View
        style={{
          flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8,
          borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)',
        }}
      >
        <Text style={[t.micro, { color: 'rgba(255,255,255,0.6)', flex: 1 }]}>
          {agent?.name ?? 'Pi'} · auto {auto ? 'on' : 'off'}
        </Text>
        {running && <ActivityIndicator size="small" color="#8E8E93" />}
        {btn(auto ? 'Auto on' : 'Auto off', () => setAuto((a) => !a))}
        {btn('Run', () => runAll(), true)}
        {btn('+ Add', () => setAdding((a) => !a))}
      </View>

      {/* Add-command row */}
      {adding && (
        <View style={{ padding: 12, gap: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' }}>
          <TextInput
            placeholder="Name (e.g. Docker status)"
            placeholderTextColor="rgba(255,255,255,0.4)"
            value={newName}
            onChangeText={setNewName}
            style={inputStyle}
          />
          <TextInput
            placeholder="Command (e.g. docker ps)"
            placeholderTextColor="rgba(255,255,255,0.4)"
            value={newCommand}
            onChangeText={setNewCommand}
            autoCapitalize="none"
            autoCorrect={false}
            style={inputStyle}
          />
          {btn('Add command', add, true)}
        </View>
      )}

      <ScrollView
        contentContainerStyle={{ padding: 12, paddingBottom: 120 }}
        automaticallyAdjustKeyboardInsets
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
      >
        {!connected && (
          <View style={{ padding: 12, borderRadius: 10, backgroundColor: 'rgba(229,85,93,0.12)', marginBottom: 12 }}>
            <Text style={{ color: '#FF9AA0', fontSize: 13 }}>
              Not connected — commands won't run until the Pi is reachable.
            </Text>
          </View>
        )}
        {cmds.map((cmd) => {
          const r = results[cmd.id];
          return (
            <View
              key={cmd.id}
              style={{
                marginBottom: 12, borderRadius: 12, overflow: 'hidden',
                backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 9, gap: 8 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: r ? (r.ok ? '#3CC06F' : '#E5555D') : '#555A5F' }} />
                <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 14, flex: 1 }}>{cmd.name}</Text>
                <Pressable onPress={() => setCmds((p) => p.filter((x) => x.id !== cmd.id))} hitSlop={8} accessibilityLabel="Remove">
                  <Ionicons name="close" size={16} color="#8E8E93" />
                </Pressable>
              </View>
              <View style={{ paddingHorizontal: 12, paddingBottom: 10 }}>
                <Text style={{ fontFamily: mono, fontSize: 12, color: '#E6E6EA', lineHeight: 17 }}>
                  {r ? r.output : '—'}
                </Text>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}
