// Windows-11-style "bloom" wave background: layered curved ribbons over a
// near-black ground. Pure SVG — no image assets, crisp at any size.
import React from 'react';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

interface Props {
  width: number;
  height: number;
  /** hue variant so multiple cards don't look identical */
  variant?: 'magenta' | 'cyan' | 'violet' | 'ember';
  dim?: boolean; // darker version for full-screen backdrops
  /** fade the bottom N px to near-black so overlaid text stays legible (no seam) */
  bottomScrim?: number;
}

const PALETTES = {
  magenta: ['#8B5CF6', '#D946EF', '#701A45', '#3B2E8C'],
  cyan: ['#2FBCCF', '#5AD0E0', '#0E4A64', '#123B8C'],
  violet: ['#7C6CE0', '#A78BFA', '#3B2E8C', '#5B21B6'],
  ember: ['#F59E0B', '#EF4444', '#7C2D12', '#831843'],
} as const;

export function WaveBackground({ width: w, height: h, variant = 'magenta', dim, bottomScrim }: Props) {
  const [c1, c2, c3, c4] = PALETTES[variant];
  const o = dim ? 0.55 : 1;
  const scrimH = bottomScrim ?? 0;
  return (
    <Svg width={w} height={h} style={{ position: 'absolute' }}>
      <Defs>
        <LinearGradient id="g1" x1="0" y1="1" x2="1" y2="0">
          <Stop offset="0" stopColor={c1} stopOpacity={0.9 * o} />
          <Stop offset="1" stopColor={c2} stopOpacity={0.15 * o} />
        </LinearGradient>
        <LinearGradient id="g2" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={c4} stopOpacity={0.85 * o} />
          <Stop offset="1" stopColor={c3} stopOpacity={0.25 * o} />
        </LinearGradient>
        <LinearGradient id="g3" x1="0" y1="1" x2="1" y2="0.2">
          <Stop offset="0" stopColor="#EEF3F5" stopOpacity={0.28 * o} />
          <Stop offset="1" stopColor="#EEF3F5" stopOpacity={0} />
        </LinearGradient>
        <LinearGradient id="scrim" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#0A0A0C" stopOpacity={0} />
          <Stop offset="0.65" stopColor="#0A0A0C" stopOpacity={0.82} />
          <Stop offset="1" stopColor="#0A0A0C" stopOpacity={0.94} />
        </LinearGradient>
      </Defs>
      <Rect x={0} y={0} width={w} height={h} fill="#0A0A0C" />
      {/* back ribbon */}
      <Path
        d={`M0,${h * 0.95} C${w * 0.25},${h * 0.55} ${w * 0.45},${h * 1.05} ${w * 0.7},${h * 0.6} S${w},${h * 0.15} ${w},${h * 0.15} L${w},${h} L0,${h} Z`}
        fill="url(#g2)"
      />
      {/* main ribbon */}
      <Path
        d={`M0,${h * 0.8} C${w * 0.2},${h * 0.35} ${w * 0.5},${h * 0.95} ${w * 0.75},${h * 0.45} S${w},${h * 0.05} ${w},${h * 0.05} L${w},${h} L0,${h} Z`}
        fill="url(#g1)"
      />
      {/* highlight edge */}
      <Path
        d={`M0,${h * 0.8} C${w * 0.2},${h * 0.35} ${w * 0.5},${h * 0.95} ${w * 0.75},${h * 0.45} S${w},${h * 0.05} ${w},${h * 0.05}`}
        stroke="url(#g3)"
        strokeWidth={2.5}
        fill="none"
      />
      {/* bottom fade so overlaid text is legible and the wave never ends in a hard seam */}
      {scrimH > 0 && <Rect x={0} y={h - scrimH} width={w} height={scrimH} fill="url(#scrim)" />}
    </Svg>
  );
}
