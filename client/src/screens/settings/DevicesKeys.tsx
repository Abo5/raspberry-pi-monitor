// Devices & keys (§15): the screen the user opens when a phone is lost.
// The current device is always first, labelled, and has no Revoke button.
import React from 'react';
import { Text, View } from 'react-native';
import { useTheme } from '../../theme';
import { useStore } from '../../store/useStore';
import { Screen, Card, Eyebrow } from '../../components/Shared';
import { hexGroups } from '../../lib/fingerprint';
import { fmtRelative } from '../../lib/format';

export function DevicesKeys() {
  const { c, type } = useTheme();
  const agent = useStore((s) => s.agents.find((a) => a.id === s.currentAgentId));
  const devices = useStore((s) => s.devices);

  return (
    <Screen>
      <Eyebrow>THIS PI</Eyebrow>
      <Card style={{ padding: 16 }}>
        <Text style={[type.title3, { color: c.text.primary }]}>{agent?.name}</Text>
        <Text style={[type.monoBody, { color: c.text.secondary, marginTop: 6 }]}>
          {agent ? hexGroups(agent.fingerprintHex).slice(0, 4).join(' ') + ' …' : ''}
        </Text>
        <Text style={[type.footnote, { color: c.text.tertiary, marginTop: 6 }]}>
          Verified {agent?.verifiedAt ? new Date(agent.verifiedAt).toDateString() : '—'}
        </Text>
      </Card>

      <Eyebrow>{`DEVICES THIS PI TRUSTS  (${devices.length})`}</Eyebrow>
      <View style={{ gap: 10 }}>
        {devices.map((d) => (
          <Card key={d.id} style={{ padding: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: d.isThisDevice ? c.status.ok : c.text.tertiary,
                  marginRight: 8,
                }}
              />
              <Text style={[type.bodyEmph, { color: c.text.primary }]}>
                {d.name}
                {d.isThisDevice ? '  · this device' : ''}
              </Text>
            </View>
            <Text style={[type.subhead, { color: c.text.secondary, marginTop: 4 }]}>
              Paired {new Date(d.pairedAt).toDateString()} · last seen {fmtRelative(d.lastSeen)}
            </Text>
          </Card>
        ))}
      </View>

      <Eyebrow>KEYS</Eyebrow>
      <Card style={{ padding: 16 }}>
        <Text style={[type.subhead, { color: c.text.secondary }]}>
          Last rotated {agent ? new Date(agent.pairedAt).toDateString() : '—'}
        </Text>
        <Text style={[type.footnote, { color: c.text.tertiary, marginTop: 8 }]}>
          Rotating replaces this phone's key on the Pi. Other devices are unaffected.
        </Text>
      </Card>
    </Screen>
  );
}
