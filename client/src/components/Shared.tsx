// Small shared primitives: Screen, Card, Eyebrow, ListRow.
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { GlassBackground } from './Glass';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme';

/** Large in-page title, same style as "Saved Devices" on the Devices home. */
export function PageTitle({ children, right }: { children: string; right?: React.ReactNode }) {
  const { type } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14, marginTop: 4 }}>
      <Text style={[type.display, { color: '#FFFFFF', fontSize: 30, flex: 1 }]}>{children}</Text>
      {right}
    </View>
  );
}

/**
 * Page shell. Dark: the same black + purple-glow backdrop as the Devices home.
 * With `title`, the page has no navigation bar — the title sits inside the page
 * (tab-root screens). Without it, content starts below the transparent header.
 */
export function Screen({
  children, scroll = true, style, title, titleRight,
}: { children: React.ReactNode; scroll?: boolean; style?: ViewStyle; title?: string; titleRight?: React.ReactNode }) {
  const { c, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const backdrop = isDark ? <GlassBackground base="#000000" strength={0.9} /> : null;
  const head = title ? <PageTitle right={titleRight}>{title}</PageTitle> : null;
  if (!scroll) {
    return (
      <View style={[{ flex: 1, backgroundColor: c.surface.canvas, paddingTop: title ? insets.top + 10 : 0 }, style]}>
        {backdrop}
        {head}
        {children}
      </View>
    );
  }
  return (
    <View style={{ flex: 1, backgroundColor: c.surface.canvas }}>
      {backdrop}
      <ScrollView
        style={{ flex: 1 }}
        contentInsetAdjustmentBehavior={title ? 'never' : 'automatic'}
        // Keyboard: native inset so fields it covers can be scrolled into view,
        // and drag-down dismisses it with the content settling back smoothly.
        automaticallyAdjustKeyboardInsets
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        // Clears the floating pill bar on tab-root screens and the home indicator
        // on pushed screens, so the last row / primary button is always reachable.
        contentContainerStyle={[{ padding: 16, paddingTop: title ? insets.top + 10 : 16, paddingBottom: 120 + insets.bottom }, style]}
      >
        {head}
        {children}
      </ScrollView>
    </View>
  );
}

export function Card({ children, style, destructive }: { children: React.ReactNode; style?: ViewStyle; destructive?: boolean }) {
  const { c, radius, isDark } = useTheme();
  return (
    <View
      style={[
        {
          // Dark: frosted glass (translucent + real blur + a light top edge).
          backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : c.surface.raised,
          borderRadius: radius.l,
          borderWidth: 1,
          borderColor: destructive ? c.border.destructive : isDark ? 'rgba(255,255,255,0.12)' : c.border.subtle,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      {isDark && <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />}
      {isDark && <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.18)' }} />}
      {children}
    </View>
  );
}

export function Eyebrow({ children, warning }: { children: string; warning?: boolean }) {
  const { c, type } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, marginTop: 20 }}>
      <Text style={[type.micro, { color: c.text.tertiary }]}>{children}</Text>
      {warning && <Ionicons name="warning-outline" size={12} color={c.status.warning} style={{ marginLeft: 6 }} />}
    </View>
  );
}

interface RowProps {
  title: string;
  subtitle?: string;
  value?: string;
  mono?: boolean;
  chevron?: boolean;
  destructive?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  /** Windows-App-style colored icon square behind the glyph */
  iconBg?: string;
  right?: React.ReactNode;
  last?: boolean;
}

export function ListRow({ title, subtitle, value, mono, chevron, destructive, disabled, onPress, icon, iconBg, right, last }: RowProps) {
  const { c, type } = useTheme();
  const ink = disabled ? c.text.disabled : destructive ? c.status.critical : c.text.primary;
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress || disabled}
      accessibilityRole={onPress ? 'button' : undefined}
      style={({ pressed }) => ({
        minHeight: subtitle ? 60 : 44,
        paddingHorizontal: 16,
        paddingVertical: 10,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: pressed ? c.surface.raised2 : 'transparent',
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: c.border.hairline,
      })}
    >
      {icon &&
        (iconBg ? (
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              backgroundColor: iconBg,
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 12,
            }}
          >
            <Ionicons name={icon} size={17} color="#FFFFFF" />
          </View>
        ) : (
          <Ionicons name={icon} size={18} color={destructive ? c.status.critical : c.text.secondary} style={{ marginRight: 12 }} />
        ))}
      <View style={{ flex: 1 }}>
        <Text style={[type.body, { color: ink }]}>{title}</Text>
        {subtitle ? (
          <Text style={[mono ? type.monoBody : type.subhead, { color: c.text.tertiary, marginTop: 2, fontSize: mono ? 13 : 15 }]} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {value ? <Text style={[type.subhead, { color: c.text.secondary, marginRight: 4 }]}>{value}</Text> : null}
      {right}
      {chevron && <Ionicons name="chevron-forward" size={14} color={c.text.tertiary} />}
    </Pressable>
  );
}
