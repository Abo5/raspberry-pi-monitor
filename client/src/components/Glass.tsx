// "Glass" design primitives: a glowing backdrop, frosted cards (real blur via
// expo-blur), and buttons. Accents follow the app icon: violet → raspberry.
import React from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle, useWindowDimensions } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';
import { useTheme } from '../theme';

// The original design's accent purple → magenta.
export const GLASS_GRADIENT = ['#8A6BEA', '#A26BEA', '#D946EF'] as const;

/** Full-screen backdrop for the original design: its dark canvas with faint
 *  purple / magenta glows (from the bloom-wave palette), just enough for the
 *  frosted glass surfaces on top to read as glass. */
export function GlassBackground({ base = '#0B0F12', strength = 1 }: { base?: string; strength?: number }) {
  const { width, height } = useWindowDimensions();
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width={width} height={height}>
        <Defs>
          <RadialGradient id="gviolet" cx="0.12" cy="0.1" r="0.7">
            <Stop offset="0" stopColor="#8B5CF6" stopOpacity={0.34 * strength} />
            <Stop offset="1" stopColor="#8B5CF6" stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="gmagenta" cx="0.95" cy="0.55" r="0.6">
            <Stop offset="0" stopColor="#D946EF" stopOpacity={0.2 * strength} />
            <Stop offset="1" stopColor="#D946EF" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x={0} y={0} width={width} height={height} fill={base} />
        <Rect x={0} y={0} width={width} height={height} fill="url(#gviolet)" />
        <Rect x={0} y={0} width={width} height={height} fill="url(#gmagenta)" />
      </Svg>
    </View>
  );
}

/** Frosted glass panel: real blur of what's behind + a faint light edge. */
export function GlassCard({
  children, style, radius = 26, intensity = 40,
}: { children: React.ReactNode; style?: ViewStyle; radius?: number; intensity?: number }) {
  return (
    <View
      style={[
        {
          borderRadius: radius, overflow: 'hidden',
          borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)',
          backgroundColor: 'rgba(255,255,255,0.05)',
        },
        style,
      ]}
    >
      <BlurView intensity={intensity} tint="dark" style={StyleSheet.absoluteFill} />
      {/* soft top highlight, like light catching the glass edge */}
      <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.22)' }} />
      {children}
    </View>
  );
}

/** Gradient fill used by primary buttons and brand tiles. */
export function GradientFill({ radius = 0, id: rawId = 'gfill' }: { radius?: number; id?: string }) {
  // SVG ids can't contain spaces/punctuation (labels and device names do).
  const id = rawId.replace(/[^A-Za-z0-9_-]/g, '_');
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: radius, overflow: 'hidden' }]}>
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={GLASS_GRADIENT[0]} />
            <Stop offset="0.55" stopColor={GLASS_GRADIENT[1]} />
            <Stop offset="1" stopColor={GLASS_GRADIENT[2]} />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

export function GlassButton({
  icon, label, onPress, primary, style, height = 48,
}: {
  icon?: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void;
  primary?: boolean; style?: ViewStyle; height?: number;
}) {
  const { type } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        {
          height, borderRadius: height / 2.6, overflow: 'hidden',
          flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
          borderWidth: primary ? 0 : 1, borderColor: 'rgba(255,255,255,0.16)',
          backgroundColor: primary ? 'transparent' : 'rgba(255,255,255,0.08)',
          opacity: pressed ? 0.8 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
        style,
      ]}
    >
      {primary && <GradientFill id={`btn-${label}`} />}
      {icon && <Ionicons name={icon} size={18} color="#FFFFFF" />}
      <Text style={[type.subhead, { color: '#FFFFFF', fontWeight: '700' }]}>{label}</Text>
    </Pressable>
  );
}

/** Round frosted icon button (header actions). */
export function GlassIconButton({
  icon, onPress, label, badge, size = 44,
}: { icon: keyof typeof Ionicons.glyphMap; onPress: () => void; label: string; badge?: number; size?: number }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} hitSlop={8}>
      {({ pressed }) => (
        <View>
          <GlassCard radius={size / 2} style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.75 : 1 }}>
            <Ionicons name={icon} size={size * 0.45} color="#FFFFFF" />
          </GlassCard>
          {badge != null && badge > 0 && (
            <View style={{ position: 'absolute', top: -3, right: -3, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: '#E0386B', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 }}>
              <Text style={{ color: '#fff', fontSize: 10, fontWeight: '800' }}>{badge}</Text>
            </View>
          )}
        </View>
      )}
    </Pressable>
  );
}
