// EmptyState (§7.14), ErrorState (§7.15), SkeletonLoader (§7.16).
import React, { useEffect, useRef } from 'react';
import { Animated, Text, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme';
import { ActionButton } from './ActionButton';

interface EmptyProps {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ icon = 'server-outline', title, body, actionLabel, onAction }: EmptyProps) {
  const { c, type } = useTheme();
  return (
    <View style={{ alignItems: 'center', paddingVertical: 40, paddingHorizontal: 24, maxWidth: 320, alignSelf: 'center' }}>
      <Ionicons name={icon} size={32} color={c.text.tertiary} />
      <Text style={[type.title3, { color: c.text.primary, marginTop: 16, textAlign: 'center' }]}>{title}</Text>
      {body ? (
        <Text style={[type.callout, { color: c.text.secondary, marginTop: 8, textAlign: 'center' }]}>{body}</Text>
      ) : null}
      {actionLabel && onAction ? (
        <ActionButton label={actionLabel} onPress={onAction} variant="secondary" style={{ marginTop: 24, alignSelf: 'stretch' }} />
      ) : null}
    </View>
  );
}

export function ErrorState({
  title, body, code, onRetry,
}: { title: string; body?: string; code?: string; onRetry?: () => void }) {
  const { c, type, radius } = useTheme();
  return (
    <View style={{ alignItems: 'center', paddingVertical: 40, paddingHorizontal: 24, maxWidth: 320, alignSelf: 'center' }}>
      <Ionicons name="warning-outline" size={32} color={c.status.warning} />
      <Text style={[type.title3, { color: c.text.primary, marginTop: 16, textAlign: 'center' }]}>{title}</Text>
      {body ? (
        <Text style={[type.callout, { color: c.text.secondary, marginTop: 8, textAlign: 'center' }]}>{body}</Text>
      ) : null}
      {code ? (
        <View style={{ backgroundColor: c.surface.sunken, borderRadius: radius.xs, padding: 6, marginTop: 12 }}>
          <Text style={[type.monoBody, { color: c.text.secondary }]}>{code}</Text>
        </View>
      ) : null}
      {onRetry ? <ActionButton label="Retry now" onPress={onRetry} style={{ marginTop: 24, alignSelf: 'stretch' }} /> : null}
    </View>
  );
}

/** Static block with a 1200ms opacity oscillation — no moving gradient (§6.3). */
export function Skeleton({ style }: { style?: ViewStyle }) {
  const { c, radius } = useTheme();
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.72, duration: 600, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 600, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, []);
  return (
    <Animated.View
      accessibilityLabel="Loading"
      style={[{ backgroundColor: c.surface.raised2, borderRadius: radius.xs, opacity }, style]}
    />
  );
}
