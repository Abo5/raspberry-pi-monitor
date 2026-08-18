// StatTile (§7.3): eyebrow · value + unit · 32pt sparkline band. Thermal tiles
// tint the unit and endpoint, never the figure (§2.7).
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTheme } from '../theme';
import { Sparkline } from './Sparkline';
import { GaugeRing } from './GaugeRing';
import { Sample } from '../types';

interface Props {
  eyebrow: string;
  value: string;
  unit?: string;
  samples?: Sample[];
  width: number;
  gauge?: number; // render a GaugeRing instead of value+sparkline
  thermalColor?: string;
  dimmed?: boolean;
  ageStamp?: string;
  onPress?: () => void;
  secondary?: string; // e.g. "3.0 / 8.0 GB"
  sparkColor?: string;
}

export function StatTile(props: Props) {
  const { c, type, radius } = useTheme();
  const {
    eyebrow, value, unit, samples, width, gauge, thermalColor, dimmed, ageStamp, onPress,
    secondary, sparkColor,
  } = props;

  const valueColor = dimmed ? c.text.secondary : c.text.primary;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${eyebrow}: ${value} ${unit ?? ''}${ageStamp ? `, ${ageStamp}` : ''}`}
      style={({ pressed }) => ({
        width,
        height: 120,
        padding: 12,
        borderRadius: radius.m,
        backgroundColor: pressed ? c.surface.raised2 : c.surface.raised,
        borderWidth: 1,
        borderColor: c.border.subtle,
        transform: [{ scale: pressed ? 0.985 : 1 }],
      })}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={[type.micro, { color: c.text.tertiary }]} numberOfLines={1}>
          {eyebrow}
        </Text>
        {ageStamp ? (
          <Text style={[type.micro, { color: c.status.warning }]}>{ageStamp}</Text>
        ) : null}
      </View>

      {gauge != null ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <GaugeRing pct={gauge} caption="USED" />
        </View>
      ) : (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 6 }}>
            <Text style={[type.metricL, { color: valueColor }]} numberOfLines={1}>
              {value}
            </Text>
            {unit ? (
              <Text style={[type.micro, { color: thermalColor ?? c.text.tertiary, marginLeft: 2 }]}>
                {unit}
              </Text>
            ) : null}
            {secondary ? (
              <Text style={[type.caption, { color: c.text.tertiary, marginLeft: 8 }]} numberOfLines={1}>
                {secondary}
              </Text>
            ) : null}
          </View>
          <View style={{ flex: 1 }} />
          {samples && samples.length > 1 ? (
            <Sparkline
              samples={samples}
              width={width - 24}
              height={32}
              color={sparkColor}
              dimmed={dimmed}
            />
          ) : null}
        </>
      )}
    </Pressable>
  );
}
