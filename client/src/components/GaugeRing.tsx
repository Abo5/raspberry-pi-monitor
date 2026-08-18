// GaugeRing (§7.5): 300° sweep starting bottom-left, gap at the bottom.
// Fill: sequential.500 under threshold, status.warning between, critical above.
import React from 'react';
import { Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../theme';

interface Props {
  pct: number; // 0..100
  caption: string;
  diameter?: number;
  warnAt?: number;
  critAt?: number;
}

export function GaugeRing({ pct, caption, diameter = 72, warnAt = 80, critAt = 90 }: Props) {
  const { c, type, isDark } = useTheme();
  const stroke = diameter >= 120 ? 12 : diameter >= 72 ? 8 : 5;
  const r = (diameter - stroke) / 2;
  const cx = diameter / 2;
  const cy = diameter / 2;
  const startDeg = 210;
  const sweepDeg = 300;

  const arc = (fromDeg: number, toDeg: number) => {
    const a0 = ((fromDeg - 90) * Math.PI) / 180;
    const a1 = ((toDeg - 90) * Math.PI) / 180;
    const large = toDeg - fromDeg > 180 ? 1 : 0;
    return `M${cx + r * Math.sin(a0 + Math.PI / 2)},${cy - r * Math.cos(a0 + Math.PI / 2)}A${r},${r} 0 ${large} 1 ${
      cx + r * Math.sin(a1 + Math.PI / 2)
    },${cy - r * Math.cos(a1 + Math.PI / 2)}`;
  };

  const fillColor =
    pct >= critAt ? c.status.critical : pct >= warnAt ? c.status.warning : c.viz.sequential[4];
  const track = isDark ? c.viz.sequential[6] : c.viz.sequential[0];
  const fillDeg = startDeg + (Math.min(100, Math.max(0, pct)) / 100) * sweepDeg;

  return (
    <View style={{ width: diameter, height: diameter, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={diameter} height={diameter} style={{ position: 'absolute' }}>
        <Path d={arc(startDeg, startDeg + sweepDeg)} stroke={track} strokeWidth={stroke} fill="none" />
        {pct > 0 && (
          <Path d={arc(startDeg, fillDeg)} stroke={fillColor} strokeWidth={stroke} fill="none" strokeLinecap="round" />
        )}
      </Svg>
      <Text style={[type.metricM, { color: c.text.primary }]}>{Math.round(pct)} %</Text>
      <Text style={[type.micro, { color: c.text.tertiary }]}>{caption}</Text>
    </View>
  );
}
