// The reboot watch state (§12.2). The rail advances on real events only; the
// elapsed counter counts real time. Never claims success it has not observed.
import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { useStore, RebootPhase } from '../../store/useStore';
import { ActionButton } from '../../components/ActionButton';
import { fmtClock } from '../../lib/format';

const STAGES: { key: RebootPhase; label: string }[] = [
  { key: 'sent', label: 'sent' },
  { key: 'acked', label: "ack'd" },
  { key: 'offline', label: 'offline' },
  { key: 'back', label: 'back' },
];

export function RebootWatch() {
  const { c, type } = useTheme();
  const nav = useNavigation<any>();
  const watch = useStore((s) => s.rebootWatch);
  const [, forceTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => forceTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (watch?.phase === 'back') {
      const t = setTimeout(() => {
        useStore.getState().set({ rebootWatch: null });
        nav.goBack();
      }, 1500);
      return () => clearTimeout(t);
    }
  }, [watch?.phase]);

  if (!watch) return <View style={{ flex: 1, backgroundColor: c.surface.canvas }} />;

  const stageIdx = STAGES.findIndex((s) => s.key === watch.phase);
  const elapsedS = Math.floor((Date.now() - watch.startedAt) / 1000);
  const mm = Math.floor(elapsedS / 60);
  const ss = (elapsedS % 60).toString().padStart(2, '0');
  const late = elapsedS > watch.expectedS * 3;

  return (
    <View style={{ flex: 1, backgroundColor: c.surface.canvas, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <Ionicons name="sync-outline" size={40} color={late ? c.status.warning : c.accent.base} />
      <Text style={[type.title2, { color: c.text.primary, marginTop: 16 }]}>
        {watch.actionName === 'Shut down' ? 'Shutting down' : 'Rebooting'}
      </Text>

      {/* 4-stage rail, advanced by real events */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 32 }}>
        {STAGES.map((s, i) => (
          <React.Fragment key={s.key}>
            {i > 0 && (
              <View style={{ width: 44, height: 2, backgroundColor: i <= stageIdx ? c.accent.base : c.border.subtle }} />
            )}
            <View style={{ alignItems: 'center' }}>
              <View
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 6,
                  backgroundColor: i <= stageIdx ? c.accent.base : 'transparent',
                  borderWidth: 2,
                  borderColor: i <= stageIdx ? c.accent.base : c.border.strong,
                }}
              />
              <Text style={[type.micro, { color: i <= stageIdx ? c.text.primary : c.text.tertiary, marginTop: 6 }]}>
                {s.label}
              </Text>
            </View>
          </React.Fragment>
        ))}
      </View>

      <Text style={[type.callout, { color: c.text.secondary, marginTop: 32, textAlign: 'center' }]}>
        {watch.offlineAt
          ? `Went offline at ${fmtClock(watch.offlineAt)}.`
          : 'Waiting for the Pi to acknowledge…'}
        {'\n'}
        {watch.actionName === 'Shut down'
          ? 'It needs physical access to restart.'
          : `Usually back in about ${watch.expectedS} seconds.`}
      </Text>

      {late && (
        <Text style={[type.callout, { color: c.status.warning, marginTop: 12, textAlign: 'center' }]}>
          It's been {mm}:{ss}, and reboots on this Pi usually take about {watch.expectedS} s. Check
          power and network, or look at it in person.
        </Text>
      )}

      <Text style={[type.hero, { color: c.text.primary, marginTop: 24 }]}>
        {mm}:{ss}
      </Text>

      <ActionButton
        label="Stop waiting"
        variant="tertiary"
        onPress={() => {
          useStore.getState().set({ rebootWatch: null });
          nav.goBack();
        }}
        style={{ marginTop: 24 }}
      />
    </View>
  );
}
