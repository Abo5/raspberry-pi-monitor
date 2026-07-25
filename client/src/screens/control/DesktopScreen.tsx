// Remote Desktop (§10). Video streaming lands in milestone M4 (Rust encoder on
// the Pi + WebRTC). This screen renders the negotiation state honestly — the
// letterbox, the milestone rail — and states what is missing rather than faking
// frames (P-D2: never fake liveness).
import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { ActionButton } from '../../components/ActionButton';

export function DesktopScreen() {
  const { c, type, radius } = useTheme();
  const nav = useNavigation<any>();
  const [milestone, setMilestone] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setMilestone((m) => Math.min(m + 1, 2)), 500);
    return () => clearInterval(t);
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: c.letterbox, justifyContent: 'center', padding: 24 }}>
      <View
        style={{
          aspectRatio: 16 / 9,
          borderRadius: radius.none,
          backgroundColor: c.surface.sunken,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 1,
          borderColor: c.border.subtle,
        }}
      >
        <View style={{ flexDirection: 'row', gap: 6, marginBottom: 16 }}>
          {[0, 1, 2, 3].map((i) => (
            <View
              key={i}
              style={{
                width: 40,
                height: 3,
                borderRadius: 2,
                backgroundColor: i <= milestone ? c.accent.base : c.surface.raised2,
              }}
            />
          ))}
        </View>
        <Text style={[type.callout, { color: c.text.primary }]}>Negotiating video…</Text>
        <Text style={[type.footnote, { color: c.text.secondary, marginTop: 8, textAlign: 'center', paddingHorizontal: 24 }]}>
          Remote Desktop needs the Agent's video encoder, which ships in milestone M4 of the
          roadmap. Telemetry, shell and actions are available now.
        </Text>
      </View>

      <View style={{ position: 'absolute', top: 60, left: 16 }}>
        <ActionButton label="✕" variant="tertiary" onPress={() => nav.goBack()} />
      </View>

      {/* Overlay pill placeholder */}
      <View
        style={{
          position: 'absolute',
          bottom: 48,
          alignSelf: 'center',
          flexDirection: 'row',
          alignItems: 'center',
          height: 44,
          paddingHorizontal: 16,
          borderRadius: radius.pill,
          backgroundColor: c.surface.raised2,
          borderWidth: 1,
          borderColor: c.border.subtle,
          gap: 14,
        }}
      >
        {(['keypad-outline', 'terminal-outline', 'options-outline'] as const).map((icon) => (
          <Ionicons key={icon} name={icon} size={18} color={c.text.secondary} />
        ))}
        <Text style={[type.metricS, { color: c.text.secondary }]}>— Mb/s</Text>
      </View>
    </View>
  );
}
