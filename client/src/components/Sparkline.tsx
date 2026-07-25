// Sparkline (§7.4): 2pt stroke, 10% area wash, endpoint dot with surface ring.
// Not a chart — no axes, no labels. Gaps are never interpolated.
import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { Sample } from '../types';
import { useTheme } from '../theme';

interface Props {
  samples: Sample[];
  width: number;
  height?: number;
  color?: string;
  dimmed?: boolean;
}

export function Sparkline({ samples, width, height = 32, color, dimmed }: Props) {
  const { c } = useTheme();
  const stroke = dimmed ? c.viz.deEmphasis : color ?? c.viz.categorical[0];
  if (samples.length < 2 || width <= 0) return <View style={{ width, height }} />;

  const vs = samples.map((s) => s.v);
  let min = Math.min(...vs);
  let max = Math.max(...vs);
  const pad = (max - min || 1) * 0.08; // y-domain padded 8%, not 0-based
  min -= pad;
  max += pad;

  const x = (i: number) => (i / (samples.length - 1)) * width;
  const y = (v: number) => height - ((v - min) / (max - min)) * height;

  let line = '';
  samples.forEach((s, i) => {
    line += `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(s.v).toFixed(1)}`;
  });
  const area = `${line}L${width},${height}L0,${height}Z`;
  const last = samples[samples.length - 1];

  return (
    <Svg width={width} height={height}>
      <Path d={area} fill={stroke} opacity={0.1} />
      <Path d={line} stroke={stroke} strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" />
      {!dimmed && (
        <>
          <Circle cx={width} cy={y(last.v)} r={5} fill={c.surface.raised} />
          <Circle cx={width} cy={y(last.v)} r={3.5} fill={c.accent.high} />
        </>
      )}
    </Svg>
  );
}
