// Small shared primitives: Screen, Card, Eyebrow, ListRow.
import React from 'react';
import { Pressable, ScrollView, Text, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme';

export function Screen({ children, scroll = true, style }: { children: React.ReactNode; scroll?: boolean; style?: ViewStyle }) {
  const { c } = useTheme();
  if (!scroll) return <View style={[{ flex: 1, backgroundColor: c.surface.canvas }, style]}>{children}</View>;
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.surface.canvas }}
      contentContainerStyle={[{ padding: 16, paddingBottom: 32 }, style]}
    >
      {children}
    </ScrollView>
  );
}

export function Card({ children, style, destructive }: { children: React.ReactNode; style?: ViewStyle; destructive?: boolean }) {
  const { c, radius } = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: c.surface.raised,
          borderRadius: radius.l,
          borderWidth: 1,
          borderColor: destructive ? c.border.destructive : c.border.subtle,
          overflow: 'hidden',
        },
        style,
      ]}
    >
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
  right?: React.ReactNode;
  last?: boolean;
}

export function ListRow({ title, subtitle, value, mono, chevron, destructive, disabled, onPress, icon, right, last }: RowProps) {
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
      {icon && <Ionicons name={icon} size={18} color={destructive ? c.status.critical : c.text.secondary} style={{ marginRight: 12 }} />}
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
