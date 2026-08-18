// ActionButton (§7.11). A disabled button must carry a reason beneath it —
// never a silently dead control.
import React from 'react';
import { ActivityIndicator, Pressable, Text, View, ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme, withAlpha } from '../theme';

type Variant = 'primary' | 'secondary' | 'tertiary' | 'destructive' | 'destructiveConfirm';

interface Props {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  disabled?: boolean;
  disabledReason?: string;
  loading?: boolean;
  loadingLabel?: string;
  style?: ViewStyle;
}

export function ActionButton({
  label, onPress, variant = 'primary', disabled, disabledReason, loading, loadingLabel, style,
}: Props) {
  const { c, type, radius } = useTheme();

  const height = variant === 'primary' || variant.startsWith('destructive') ? 50 : 44;
  const styles: Record<Variant, { bg: string; ink: string; border?: string }> = {
    primary: { bg: c.accent.base, ink: c.text.onAccent },
    secondary: { bg: withAlpha(c.accent.base, c.accent.washAlpha), ink: c.accent.base, border: withAlpha(c.accent.base, 0.4) },
    tertiary: { bg: 'transparent', ink: c.accent.base },
    destructive: { bg: withAlpha(c.status.critical, 0.14), ink: c.status.critical, border: c.border.destructive },
    destructiveConfirm: { bg: c.status.critical, ink: c.text.onCritical },
  };
  const s = styles[variant];

  return (
    <View style={style}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: !!disabled }}
        disabled={disabled || loading}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onPress?.();
        }}
        style={({ pressed }) => ({
          height,
          borderRadius: radius.s,
          paddingHorizontal: 16,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          backgroundColor: disabled ? c.surface.raised2 : pressed && variant === 'primary' ? c.accent.pressed : s.bg,
          borderWidth: s.border && !disabled ? 1 : 0,
          borderColor: s.border,
          transform: [{ scale: pressed && !disabled ? 0.98 : 1 }],
        })}
      >
        {loading && <ActivityIndicator size="small" color={s.ink} style={{ marginRight: 8 }} />}
        <Text style={[type.bodyEmph, { color: disabled ? c.text.disabled : s.ink }]}>
          {loading && loadingLabel ? loadingLabel : label}
        </Text>
      </Pressable>
      {disabled && disabledReason ? (
        <Text style={[type.footnote, { color: c.text.tertiary, marginTop: 6, textAlign: 'center' }]}>
          {disabledReason}
        </Text>
      ) : null}
    </View>
  );
}
