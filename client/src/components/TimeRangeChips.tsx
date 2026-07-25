// One filter row above the content it scopes — never per-card (§7.2).
import React from 'react';
import { Pressable, ScrollView, Text } from 'react-native';
import { useTheme, withAlpha } from '../theme';
import { TimeRange } from '../types';

const RANGES: TimeRange[] = ['15m', '1h', '6h', '24h', '7d', '30d'];

export function TimeRangeChips({
  value, onChange,
}: { value: TimeRange; onChange: (r: TimeRange) => void }) {
  const { c, type, radius } = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
      {RANGES.map((r) => {
        const selected = r === value;
        return (
          <Pressable
            key={r}
            onPress={() => onChange(r)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            style={{
              paddingHorizontal: 14,
              height: 30,
              borderRadius: radius.pill,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: selected ? withAlpha(c.accent.base, c.accent.washAlpha) : 'transparent',
              borderWidth: 1,
              borderColor: selected ? c.accent.base : c.border.subtle,
            }}
          >
            <Text style={[type.footnote, { color: selected ? c.accent.base : c.text.secondary, fontWeight: selected ? '600' : '400' }]}>
              {r}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
