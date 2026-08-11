// MetricChart (§7.6, §8): plot + gridlines + threshold rules + 24pt axis band.
// Thresholds are dashed (the one sanctioned dash besides status.unknown).
// Scrub: drag snaps a crosshair to the nearest sample and the header readout
// becomes the scrubbed value — nothing floats over the plot under the finger.
import React, { useMemo, useState } from 'react';
import { LayoutChangeEvent, Text, View } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { useTheme } from '../theme';
import { Sample } from '../types';
import { fmtClock } from '../lib/format';

interface Threshold {
  value: number;
  color: string;
  label?: string;
}

interface Props {
  title: string;
  samples: Sample[];
  unit: string;
  formatValue: (v: number) => string;
  thresholds?: Threshold[];
  height?: number;
  color?: string;
  subtitle?: string;
  scrubEnabled?: boolean;
}

export function MetricChart({
  title, samples, unit, formatValue, thresholds = [], height = 176, color, subtitle, scrubEnabled = true,
}: Props) {
  const { c, type, radius } = useTheme();
  const [width, setWidth] = useState(0);
  const [scrubIdx, setScrubIdx] = useState<number | null>(null);
  const stroke = color ?? c.viz.categorical[0];

  const { min, max } = useMemo(() => {
    if (!samples.length) return { min: 0, max: 1 };
    const vs = samples.map((s) => s.v);
    let lo = Math.min(...vs);
    let hi = Math.max(...vs);
    thresholds.forEach((th) => {
      hi = Math.max(hi, th.value * 1.05);
    });
    const pad = (hi - lo || 1) * 0.1;
    return { min: lo - pad, max: hi + pad };
  }, [samples, thresholds]);

  const x = (i: number) => (i / Math.max(1, samples.length - 1)) * width;
  const y = (v: number) => height - ((v - min) / (max - min)) * height;

  const linePath = useMemo(() => {
    let d = '';
    samples.forEach((s, i) => {
      d += `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(s.v).toFixed(1)}`;
    });
    return d;
  }, [samples, width, min, max]);

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);
  const active = scrubIdx != null ? samples[scrubIdx] : samples[samples.length - 1];

  const handleTouch = (evt: { nativeEvent: { locationX: number } }) => {
    if (!scrubEnabled || !samples.length || width === 0) return;
    const i = Math.round((evt.nativeEvent.locationX / width) * (samples.length - 1));
    setScrubIdx(Math.min(samples.length - 1, Math.max(0, i)));
  };

  const gridYs = [0.25, 0.5, 0.75].map((f) => height * f);
  const tickIdxs = samples.length > 1 ? [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(f * (samples.length - 1))) : [];

  return (
    <View
      style={{
        borderRadius: radius.l,
        backgroundColor: c.surface.raised,
        borderWidth: 1,
        borderColor: c.border.subtle,
        padding: 16,
      }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
        <Text style={[type.micro, { color: c.text.tertiary }]}>{title}</Text>
        {scrubIdx != null && (
          <Text style={[type.micro, { color: c.accent.base }]}>PAUSED · release to resume</Text>
        )}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', marginBottom: 8 }}>
        <Text style={[type.metricM, { color: c.text.primary }]}>
          {active ? formatValue(active.v) : '—'}
        </Text>
        <Text style={[type.micro, { color: c.text.tertiary, marginLeft: 2 }]}>{unit}</Text>
        <Text style={[type.caption, { color: c.text.tertiary, marginLeft: 8 }]}>
          {scrubIdx != null && active ? `at ${fmtClock(active.t)}` : 'now'}
        </Text>
      </View>

      <View
        onLayout={onLayout}
        onStartShouldSetResponder={() => scrubEnabled}
        onMoveShouldSetResponder={() => scrubEnabled}
        onResponderGrant={handleTouch}
        onResponderMove={handleTouch}
        onResponderRelease={() => setScrubIdx(null)}
        style={{ height }}
      >
        {width > 0 && samples.length > 1 && (
          <Svg width={width} height={height}>
            {gridYs.map((gy) => (
              <Line key={gy} x1={0} y1={gy} x2={width} y2={gy} stroke={c.viz.gridline} strokeWidth={1} />
            ))}
            {thresholds.map((th) => (
              <Line
                key={th.value}
                x1={0}
                y1={y(th.value)}
                x2={width}
                y2={y(th.value)}
                stroke={th.color}
                strokeWidth={2}
                strokeDasharray="4,3"
              />
            ))}
            <Path d={`${linePath}L${width},${height}L0,${height}Z`} fill={stroke} opacity={0.08} />
            <Path d={linePath} stroke={stroke} strokeWidth={2} fill="none" strokeLinejoin="round" />
            {scrubIdx != null && (
              <>
                <Line x1={x(scrubIdx)} y1={0} x2={x(scrubIdx)} y2={height} stroke={c.text.secondary} strokeWidth={1} />
                <Circle cx={x(scrubIdx)} cy={y(samples[scrubIdx].v)} r={4} fill={stroke} stroke={c.surface.raised} strokeWidth={2} />
              </>
            )}
            <Line x1={0} y1={height} x2={width} y2={height} stroke={c.viz.axis} strokeWidth={1} />
          </Svg>
        )}
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4, height: 20 }}>
        {tickIdxs.map((i, n) => (
          <Text key={n} style={[type.metricS, { color: c.viz.tick, fontSize: 11 }]}>
            {fmtClock(samples[i].t)}
          </Text>
        ))}
      </View>
      {subtitle ? (
        <Text style={[type.caption, { color: c.text.tertiary, marginTop: 2 }]}>{subtitle}</Text>
      ) : null}
    </View>
  );
}
