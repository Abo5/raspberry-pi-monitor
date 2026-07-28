// Remote screen (RDP-style). After connecting, this is what you see: the Pi's
// desktop, full-screen, with a floating control bar.
//
// Real video streaming needs the Agent's screen capture + encoder (roadmap
// Phase 5). Until then this shows a faithful SIMULATED Raspberry Pi OS desktop
// so the connect→sign-in→screen flow works end to end. The control bar routes
// to the live Monitor and the (real, simulated) Shell.
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { useStore } from '../../store/useStore';
import { metricValue } from '../../sim/metrics';
import { fmtTemp, fmtPct } from '../../lib/format';
import { mono } from '../../theme/typography';

export function RemoteSession() {
  const { c, type } = useTheme();
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const agentId = route.params?.agentId as string;
  const agent = useStore((s) => s.agents.find((a) => a.id === agentId));
  const [overlay, setOverlay] = useState(true);
  const [, tick] = useState(0);

  // A gentle live clock in the mock desktop's corner + refresh of mock stats.
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 2000);
    return () => clearInterval(t);
  }, []);

  const fade = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.timing(fade, { toValue: overlay ? 1 : 0, duration: 200, useNativeDriver: true }).start();
  }, [overlay]);

  const now = Date.now();
  const temp = metricValue('cpu.temp_c', now);
  const cpu = metricValue('cpu.util_pct', now);
  const clock = new Date();
  const clockStr = `${clock.getHours().toString().padStart(2, '0')}:${clock.getMinutes().toString().padStart(2, '0')}`;

  // Terminal window geometry (shared with the drawn window + text overlay).
  const tw = Math.min(width - 40, 520);
  const th = Math.min(height * 0.42, 320);
  const tx = (width - tw) / 2;
  const ty = height * 0.28;

  const host = agent?.hostname ?? 'pi';
  const termLines = [
    `${host}@${host}:~ $ vcgencmd measure_temp`,
    `temp=${fmtTemp(temp)}'C`,
    `${host}@${host}:~ $ uptime`,
    ` ${clockStr} up 14 days,  load: ${(cpu / 100 * 4).toFixed(2)}`,
    `${host}@${host}:~ $ █`,
  ];

  return (
    <Pressable style={{ flex: 1, backgroundColor: '#0A0A0C' }} onPress={() => setOverlay((v) => !v)}>
      {/* Simulated Raspberry Pi OS desktop */}
      <MockDesktop width={width} height={height} tx={tx} ty={ty} tw={tw} th={th} />

      {/* live terminal text over the drawn window */}
      <View style={{ position: 'absolute', left: tx + 12, top: ty + 38, width: tw - 24 }} pointerEvents="none">
        {termLines.map((l, i) => (
          <Text key={i} style={{ fontFamily: mono, fontSize: 12, lineHeight: 18, color: i === 1 || i === 3 ? '#C7D1D7' : '#5AD98A' }}>
            {l}
          </Text>
        ))}
      </View>

      {/* clock in the menu bar */}
      <Text style={{ position: 'absolute', right: 24, top: insets.top > 0 ? 22 : 22, color: '#EAEAF0', fontFamily: mono, fontSize: 13 }} pointerEvents="none">
        {clockStr}
      </Text>

      {/* preview badge */}
      <View style={{ position: 'absolute', left: 16, top: (insets.top || 8) + 74 }} pointerEvents="none">
        <View style={{ backgroundColor: 'rgba(20,20,24,0.8)', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5 }}>
          <Text style={[type.micro, { color: 'rgba(255,255,255,0.7)' }]}>SIMULATED DESKTOP · LIVE VIDEO IN M5</Text>
        </View>
      </View>

      {/* Top control bar */}
      <Animated.View
        pointerEvents={overlay ? 'auto' : 'none'}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          paddingTop: insets.top,
          backgroundColor: 'rgba(10,10,12,0.72)',
          opacity: fade,
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 12,
          paddingBottom: 8,
        }}
      >
        <Pressable onPress={() => nav.goBack()} hitSlop={12} style={{ padding: 8 }} accessibilityLabel="Disconnect">
          <Ionicons name="close" size={22} color="#FFFFFF" />
        </Pressable>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={[type.bodyEmph, { color: '#FFFFFF' }]}>{agent?.name}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c.status.ok }} />
            <Text style={[type.micro, { color: 'rgba(255,255,255,0.7)' }]}>CONNECTED · 34 ms</Text>
          </View>
        </View>
        <View style={{ width: 38 }} />
      </Animated.View>

      {/* Bottom control pill: Monitor · Shell · Keyboard · Disconnect */}
      <Animated.View
        pointerEvents={overlay ? 'auto' : 'none'}
        style={{
          position: 'absolute',
          bottom: insets.bottom + 14,
          alignSelf: 'center',
          flexDirection: 'row',
          backgroundColor: 'rgba(20,20,24,0.92)',
          borderRadius: 30,
          padding: 6,
          gap: 4,
          opacity: fade,
        }}
      >
        <CtrlButton icon="speedometer-outline" label="Monitor" onPress={() => nav.navigate('MonitorTab')} />
        <CtrlButton icon="terminal-outline" label="Shell" onPress={() => nav.navigate('ControlTab', { screen: 'Shell' })} />
        <CtrlButton icon="close" label="Leave" tint={c.status.critical} onPress={() => nav.goBack()} />
      </Animated.View>

      {/* One-time hint */}
      {overlay && (
        <View style={{ position: 'absolute', bottom: insets.bottom + 74, alignSelf: 'center' }}>
          <Text style={[type.footnote, { color: 'rgba(255,255,255,0.5)' }]}>Tap the screen to hide the controls</Text>
        </View>
      )}
    </Pressable>
  );
}

function CtrlButton({
  icon, label, onPress, tint,
}: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; tint?: string }) {
  const { c, type } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 7,
        paddingHorizontal: 16,
        height: 46,
        borderRadius: 24,
        backgroundColor: pressed ? 'rgba(255,255,255,0.08)' : 'transparent',
      })}
    >
      <Ionicons name={icon} size={19} color={tint ?? c.accent.high} />
      <Text style={[type.subhead, { color: tint ?? '#FFFFFF', fontWeight: '600' }]}>{label}</Text>
    </Pressable>
  );
}

/** A static-but-plausible Raspberry Pi OS desktop, drawn in SVG (no assets). */
function MockDesktop({
  width, height, tx, ty, tw, th,
}: { width: number; height: number; tx: number; ty: number; tw: number; th: number }) {
  return (
    <Svg width={width} height={height} style={{ position: 'absolute' }}>
      <Defs>
        <LinearGradient id="wall" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#3B2E8C" />
          <Stop offset="0.5" stopColor="#5B21B6" />
          <Stop offset="1" stopColor="#1E1B4B" />
        </LinearGradient>
      </Defs>
      {/* wallpaper */}
      <Rect x={0} y={0} width={width} height={height} fill="url(#wall)" />
      <Path
        d={`M0,${height * 0.7} C${width * 0.3},${height * 0.55} ${width * 0.6},${height * 0.85} ${width},${height * 0.6} L${width},${height} L0,${height} Z`}
        fill="#000000"
        opacity={0.25}
      />

      {/* top menu bar (LXDE/labwc-ish) */}
      <Rect x={0} y={0} width={width} height={64} fill="#1A1A1F" opacity={0.92} />
      <Circle cx={28} cy={32} r={9} fill="#C51A4A" />
      <Rect x={44} y={24} width={54} height={16} rx={4} fill="#2A2A32" />
      <Rect x={width - 92} y={24} width={72} height={16} rx={4} fill="#2A2A32" />

      {/* a "terminal" window */}
      <Rect x={tx} y={ty} width={tw} height={th} rx={10} fill="#0B0B0F" opacity={0.96} />
      <Rect x={tx} y={ty} width={tw} height={28} rx={10} fill="#22222A" />
      <Circle cx={tx + 16} cy={ty + 14} r={5} fill="#F2564F" />
      <Circle cx={tx + 34} cy={ty + 14} r={5} fill="#E0A61C" />
      <Circle cx={tx + 52} cy={ty + 14} r={5} fill="#2FB463" />
    </Svg>
  );
}
