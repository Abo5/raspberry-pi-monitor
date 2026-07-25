// Diagnostics — the connection inspector (§16). Field names match the Glossary
// exactly so a value copied from here can be pasted into an issue.
import React from 'react';
import { Text, View } from 'react-native';
import { useTheme } from '../../theme';
import { useStore } from '../../store/useStore';
import { Screen, Card, Eyebrow } from '../../components/Shared';
import { Sparkline } from '../../components/Sparkline';
import { EmptyState } from '../../components/States';
import { ActionButton } from '../../components/ActionButton';
import { hexGroups } from '../../lib/fingerprint';
import { fmtClock } from '../../lib/format';
import { goOffline, startTunnel } from '../../sim/tunnel';

function FactRow({ k, v }: { k: string; v: string }) {
  const { c, type } = useTheme();
  return (
    <View style={{ flexDirection: 'row', paddingVertical: 3 }}>
      <Text style={[type.micro, { color: c.text.tertiary, width: 110, paddingTop: 3 }]}>{k.toUpperCase()}</Text>
      <Text style={[type.monoBody, { color: c.text.primary, flex: 1 }]}>{v}</Text>
    </View>
  );
}

export function Diagnostics() {
  const { c, type } = useTheme();
  const agent = useStore((s) => s.agents.find((a) => a.id === s.currentAgentId));
  const connection = useStore((s) => s.connection);
  const rtt = useStore((s) => s.rttHistory);
  const events = useStore((s) => s.events);
  const shellOpen = useStore((s) => s.shellSessionStartedAt != null);

  if (connection.kind === 'unknown') {
    return (
      <Screen>
        <EmptyState
          icon="pulse-outline"
          title="Never connected"
          body={`This phone hasn't reached ${agent?.name ?? 'the Pi'} yet, so there's nothing to inspect.`}
        />
      </Screen>
    );
  }

  const connected = connection.kind === 'connected';
  const rttNow = connected ? connection.rttMs : null;
  const vs = rtt.map((r) => r.v).sort((a, b) => a - b);
  const p = (f: number) => (vs.length ? Math.round(vs[Math.min(vs.length - 1, Math.floor(vs.length * f))]) : 0);

  const channels: [string, boolean, string][] = [
    ['control', connected, '↑ 4.1 KB ↓ 12 KB'],
    ['telemetry', connected, '↑ 0.2 KB ↓ 880 KB'],
    ['shell', connected && shellOpen, shellOpen ? '↑ 3.4 KB ↓ 41 KB' : ''],
    ['screen', false, ''],
    ['input', false, ''],
    ['files', false, ''],
  ];

  return (
    <Screen>
      <Eyebrow>TUNNEL</Eyebrow>
      <Card style={{ padding: 14 }}>
        <FactRow k="State" v={connected ? 'established' : connection.kind} />
        <FactRow k="Path" v={connected ? `${connection.path} (server-reflexive)` : '—'} />
        <FactRow k="Transport" v="WebSocket (simulated)" />
        <FactRow k="Local" v="192.168.1.44:54210" />
        <FactRow k="Remote" v="81.x.x.x:41822" />
      </Card>

      <Eyebrow>LATENCY</Eyebrow>
      <Card style={{ padding: 14 }}>
        <Sparkline samples={rtt.map((r) => ({ t: r.t, v: r.v }))} width={300} height={36} />
        <Text style={[type.metricS, { color: c.text.secondary, marginTop: 8 }]}>
          now {rttNow ?? '—'} ms · p50 {p(0.5)} · p95 {p(0.95)} · max {vs.length ? vs[vs.length - 1] : '—'}
        </Text>
      </Card>

      <Eyebrow>CHANNELS</Eyebrow>
      <Card style={{ padding: 14 }}>
        {channels.map(([name, open, traffic]) => (
          <View key={name} style={{ flexDirection: 'row', paddingVertical: 3 }}>
            <Text style={[type.monoBody, { color: c.text.primary, width: 100 }]}>{name}</Text>
            <Text style={[type.monoBody, { color: open ? c.status.ok : c.text.tertiary, width: 70 }]}>
              {open ? 'open' : 'closed'}
            </Text>
            <Text style={[type.monoBody, { color: c.text.secondary, flex: 1 }]}>{traffic}</Text>
          </View>
        ))}
      </Card>

      <Eyebrow>SECURITY</Eyebrow>
      <Card style={{ padding: 14 }}>
        <FactRow k="Handshake" v="Noise_IK" />
        <FactRow k="Peer key" v={agent ? hexGroups(agent.fingerprintHex).slice(0, 4).join(' ') + ' …' : '—'} />
        <FactRow k="Verified" v={agent?.verifiedAt ? new Date(agent.verifiedAt).toDateString() : 'no'} />
        <FactRow k="Forward sec." v="yes (ephemeral)" />
      </Card>

      <Eyebrow>RECENT EVENTS</Eyebrow>
      <Card style={{ padding: 14 }}>
        {events.slice(0, 12).map((e, i) => (
          <View key={i} style={{ flexDirection: 'row', paddingVertical: 2 }}>
            <Text style={[type.monoBody, { color: c.text.tertiary, width: 60, fontSize: 12 }]}>{fmtClock(e.t)}</Text>
            <Text
              style={[
                type.monoBody,
                {
                  color: e.level === 'WARN' ? c.status.warning : e.level === 'ERROR' ? c.status.critical : c.text.secondary,
                  width: 50,
                  fontSize: 12,
                },
              ]}
            >
              {e.level}
            </Text>
            <Text style={[type.monoBody, { color: c.text.primary, flex: 1, fontSize: 12 }]}>{e.message}</Text>
          </View>
        ))}
        {events.length === 0 && <Text style={[type.footnote, { color: c.text.tertiary }]}>No events yet.</Text>}
      </Card>

      <ActionButton
        label="Run a connection test"
        variant="secondary"
        onPress={() => {
          const add = useStore.getState().addEvent;
          add('INFO', 'test: resolve rendezvous · pass · 41ms');
          add('INFO', 'test: gather candidates · pass · 122ms');
          add('INFO', 'test: attempt direct · pass · 88ms');
          add('INFO', 'test: handshake · pass · 64ms');
          add('INFO', 'test: echo on control · pass · 35ms');
        }}
        style={{ marginTop: 24 }}
      />
      <ActionButton
        label="Simulate a 10 s outage"
        variant="tertiary"
        onPress={() => {
          goOffline();
          setTimeout(startTunnel, 10_000);
        }}
        style={{ marginTop: 8 }}
      />
    </Screen>
  );
}
