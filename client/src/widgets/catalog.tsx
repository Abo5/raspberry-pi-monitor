// Widget catalog: every design the gallery offers, rendered live from the
// simulated Agent so previews show real numbers. Families follow WidgetKit:
// systemSmall / systemMedium (Home Screen) and accessoryCircular /
// accessoryRectangular / accessoryInline (Lock Screen, monochrome by design).
import React from 'react';
import { Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { mono } from '../theme/typography';
import { dark } from '../theme/colors';
import { metricValue, sampleSeries } from '../sim/metrics';
import { fmtBps, fmtDuration, fmtPct, fmtTemp } from '../lib/format';
import { WaveBackground } from '../components/WaveBackground';
import { Sparkline } from '../components/Sparkline';
import { SeriesKey } from '../types';

// Data (ids, families, sizes) lives in designs.ts so it can be imported without
// pulling in React Native. Re-exported here for existing call sites.
export { CATALOG, FAMILY_META } from './designs';
export type { WidgetFamily, WidgetDesign } from './designs';

// ---------- shared bits ----------

const c = dark;

function now() {
  return Date.now();
}

function spark(key: SeriesKey, points = 24) {
  const t = now();
  return sampleSeries(key, t - 3_600_000, t, points);
}

function MonoRing({ pct, label, value }: { pct: number; label: string; value: string }) {
  // Lock-screen circular gauge: white on transparent, 270° sweep.
  const r = 30;
  const cx = 38;
  const cy = 38;
  const arc = (from: number, to: number) => {
    const a0 = ((from - 90) * Math.PI) / 180;
    const a1 = ((to - 90) * Math.PI) / 180;
    const large = to - from > 180 ? 1 : 0;
    return `M${cx + r * Math.cos(a0)},${cy + r * Math.sin(a0)}A${r},${r} 0 ${large} 1 ${cx + r * Math.cos(a1)},${cy + r * Math.sin(a1)}`;
  };
  const start = 135;
  const sweep = 270;
  return (
    <View style={{ width: 76, height: 76, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={76} height={76} style={{ position: 'absolute' }}>
        <Path d={arc(start, start + sweep)} stroke="rgba(255,255,255,0.28)" strokeWidth={5} fill="none" strokeLinecap="round" />
        {pct > 1 && (
          <Path d={arc(start, start + (sweep * Math.min(100, pct)) / 100)} stroke="#FFFFFF" strokeWidth={5} fill="none" strokeLinecap="round" />
        )}
      </Svg>
      <Text style={{ fontFamily: mono, fontSize: 15, fontWeight: '600', color: '#FFFFFF', fontVariant: ['tabular-nums'] }}>
        {value}
      </Text>
      <Text style={{ fontSize: 8, fontWeight: '700', color: 'rgba(255,255,255,0.6)', letterSpacing: 0.5 }}>{label}</Text>
    </View>
  );
}

function MonoSpark({ samples, width, height }: { samples: { t: number; v: number }[]; width: number; height: number }) {
  const vs = samples.map((s) => s.v);
  let min = Math.min(...vs);
  let max = Math.max(...vs);
  const pad = (max - min || 1) * 0.1;
  min -= pad;
  max += pad;
  const x = (i: number) => (i / (samples.length - 1)) * width;
  const y = (v: number) => height - ((v - min) / (max - min)) * height;
  let d = '';
  samples.forEach((s, i) => {
    d += `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(s.v).toFixed(1)}`;
  });
  return (
    <Svg width={width} height={height}>
      <Path d={d} stroke="#FFFFFF" strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" />
      <Circle cx={width} cy={y(vs[vs.length - 1])} r={3} fill="#FFFFFF" />
    </Svg>
  );
}

function Eyebrow({ children, color = c.text.tertiary }: { children: string; color?: string }) {
  return (
    <Text style={{ fontSize: 9.5, fontWeight: '700', letterSpacing: 0.7, color, textTransform: 'uppercase' }}>
      {children}
    </Text>
  );
}

function Metric({ v, unit, size = 26, color = c.text.primary }: { v: string; unit?: string; size?: number; color?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
      <Text style={{ fontFamily: mono, fontSize: size, fontWeight: '600', color, fontVariant: ['tabular-nums'] }}>{v}</Text>
      {unit ? <Text style={{ fontSize: size * 0.42, fontWeight: '700', color: c.text.tertiary, marginLeft: 2 }}>{unit}</Text> : null}
    </View>
  );
}

function SmallFrame({ children, plain }: { children: React.ReactNode; plain?: boolean }) {
  return (
    <View
      style={{
        width: 152,
        height: 152,
        borderRadius: 28,
        backgroundColor: plain ? undefined : '#15151A',
        overflow: 'hidden',
        padding: 14,
      }}
    >
      {children}
    </View>
  );
}

function MediumFrame({ children, noPad }: { children: React.ReactNode; noPad?: boolean }) {
  return (
    <View
      style={{
        width: 318,
        height: 152,
        borderRadius: 28,
        backgroundColor: '#15151A',
        overflow: 'hidden',
        padding: noPad ? 0 : 14,
      }}
    >
      {children}
    </View>
  );
}

// ---------- the renderer ----------

export function WidgetPreview({ id, agentName }: { id: string; agentName: string }) {
  const t = now();
  const temp = metricValue('cpu.temp_c', t);
  const cpu = metricValue('cpu.util_pct', t);
  const memPct = metricValue('mem.used_pct', t);
  const disk = metricValue('disk.used_pct', t);
  const load = metricValue('load.1m', t);
  const rx = fmtBps(metricValue('net.rx_bps', t));
  const tx = fmtBps(metricValue('net.tx_bps', t));
  const up = fmtDuration(metricValue('sys.uptime_s', t));
  const thermal = temp >= 74 ? c.thermal.steps[3] : temp >= 60 ? c.thermal.steps[1] : c.viz.categorical[0];

  switch (id) {
    // ---- Home Small ----
    case 'sm-temp-ring': {
      const pct = ((temp - 35) / 50) * 100;
      return (
        <SmallFrame>
          <Eyebrow>SOC TEMP</Eyebrow>
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Svg width={92} height={92} style={{ position: 'absolute' }}>
              <Circle cx={46} cy={46} r={38} stroke="#23232A" strokeWidth={9} fill="none" />
              <Circle
                cx={46}
                cy={46}
                r={38}
                stroke={thermal}
                strokeWidth={9}
                fill="none"
                strokeLinecap="round"
                strokeDasharray={`${(Math.min(100, pct) / 100) * 2 * Math.PI * 38},999`}
                transform="rotate(-90 46 46)"
              />
            </Svg>
            <Metric v={fmtTemp(temp)} unit="°C" size={20} />
          </View>
        </SmallFrame>
      );
    }
    case 'sm-temp-big':
      return (
        <SmallFrame>
          <Eyebrow>SOC TEMP</Eyebrow>
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <Metric v={fmtTemp(temp)} unit="°C" size={34} color={thermal === c.viz.categorical[0] ? c.text.primary : thermal} />
          </View>
          <Sparkline samples={spark('cpu.temp_c')} width={124} height={28} color={thermal} />
        </SmallFrame>
      );
    case 'sm-cpu-spark':
      return (
        <SmallFrame>
          <Eyebrow>CPU</Eyebrow>
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <Metric v={fmtPct(cpu)} unit="%" size={34} />
          </View>
          <Sparkline samples={spark('cpu.util_pct')} width={124} height={28} />
        </SmallFrame>
      );
    case 'sm-load-spark':
      return (
        <SmallFrame>
          <Eyebrow>LOAD 1M</Eyebrow>
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <Metric v={load.toFixed(2)} size={34} />
          </View>
          <Sparkline samples={spark('load.1m')} width={124} height={28} color={c.viz.categorical[2]} />
        </SmallFrame>
      );
    case 'sm-mem-bar':
      return (
        <SmallFrame>
          <Eyebrow>MEMORY</Eyebrow>
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <Metric v={fmtPct(memPct)} unit="%" size={34} />
            <Text style={{ fontSize: 11, color: c.text.tertiary, marginTop: 2 }}>
              {(memPct * 0.08).toFixed(1)} / 8.0 GB
            </Text>
          </View>
          <View style={{ height: 8, borderRadius: 4, backgroundColor: '#23232A' }}>
            <View style={{ height: 8, borderRadius: 4, width: `${memPct}%`, backgroundColor: c.viz.categorical[0] }} />
          </View>
        </SmallFrame>
      );
    case 'sm-disk-ring': {
      return (
        <SmallFrame>
          <Eyebrow>DISK /</Eyebrow>
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Svg width={92} height={92} style={{ position: 'absolute' }}>
              <Circle cx={46} cy={46} r={38} stroke="#23232A" strokeWidth={9} fill="none" />
              <Circle
                cx={46}
                cy={46}
                r={38}
                stroke={disk > 85 ? c.status.warning : c.viz.sequential[4]}
                strokeWidth={9}
                fill="none"
                strokeLinecap="round"
                strokeDasharray={`${(disk / 100) * 2 * Math.PI * 38},999`}
                transform="rotate(-90 46 46)"
              />
            </Svg>
            <Metric v={`${Math.round(disk)}`} unit="%" size={22} />
          </View>
        </SmallFrame>
      );
    }
    case 'sm-status':
      return (
        <SmallFrame>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.status.ok }} />
            <Eyebrow color={c.status.ok}>ONLINE</Eyebrow>
          </View>
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <Text style={{ fontSize: 17, fontWeight: '600', color: c.text.primary }} numberOfLines={1}>
              {agentName}
            </Text>
            <Text style={{ fontSize: 11, color: c.text.tertiary, marginTop: 3 }}>direct · 34 ms</Text>
          </View>
          <Text style={{ fontSize: 11, color: c.text.tertiary }}>updated now</Text>
        </SmallFrame>
      );
    case 'sm-net':
      return (
        <SmallFrame>
          <Eyebrow>NETWORK</Eyebrow>
          <View style={{ flex: 1, justifyContent: 'center', gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="arrow-down" size={14} color={c.viz.categorical[0]} />
              <Metric v={rx.value} unit={rx.unit} size={19} />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="arrow-up" size={14} color={c.viz.categorical[1]} />
              <Metric v={tx.value} unit={tx.unit} size={19} />
            </View>
          </View>
        </SmallFrame>
      );
    case 'sm-uptime':
      return (
        <SmallFrame>
          <Eyebrow>UPTIME</Eyebrow>
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <Metric v={up} size={30} />
            <Text style={{ fontSize: 11, color: c.text.tertiary, marginTop: 4 }}>since last boot</Text>
          </View>
        </SmallFrame>
      );
    case 'sm-terminal':
      return (
        <SmallFrame>
          <View style={{ flex: 1, justifyContent: 'center', gap: 3 }}>
            <Text style={{ fontFamily: mono, fontSize: 10, color: c.terminal.ansi[10] }}>pi@{agentName.slice(0, 8)} $</Text>
            <Text style={{ fontFamily: mono, fontSize: 10, color: c.terminal.ansi[7] }}>temp={fmtTemp(temp)}'C</Text>
            <Text style={{ fontFamily: mono, fontSize: 10, color: c.terminal.ansi[7] }}>cpu={fmtPct(cpu)}%</Text>
            <Text style={{ fontFamily: mono, fontSize: 10, color: c.terminal.ansi[7] }}>up {up}</Text>
            <View style={{ width: 7, height: 12, backgroundColor: c.terminal.cursor }} />
          </View>
        </SmallFrame>
      );
    case 'sm-bloom':
      return (
        <SmallFrame plain>
          <View style={{ position: 'absolute', top: 0, left: 0 }}>
            <WaveBackground width={152} height={152} variant="magenta" />
          </View>
          <View style={{ flex: 1, justifyContent: 'flex-end' }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#FFFFFF' }} numberOfLines={1}>
              {agentName}
            </Text>
            <Metric v={fmtTemp(temp)} unit="°C" size={24} color="#FFFFFF" />
          </View>
        </SmallFrame>
      );
    case 'sm-minimal':
      return (
        <SmallFrame>
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Metric v={`${Math.round(temp)}°`} size={54} />
          </View>
        </SmallFrame>
      );

    // ---- Home Medium ----
    case 'md-overview':
      return (
        <MediumFrame>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: c.status.ok, marginRight: 5 }} />
            <Eyebrow>{agentName}</Eyebrow>
          </View>
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4 }}>
            {[
              ['CPU', `${fmtPct(cpu)}%`],
              ['TEMP', `${fmtTemp(temp)}°`],
              ['MEM', `${fmtPct(memPct)}%`],
              ['DISK', `${Math.round(disk)}%`],
            ].map(([k, v]) => (
              <View key={k} style={{ alignItems: 'center' }}>
                <Eyebrow>{k}</Eyebrow>
                <Metric v={v} size={21} />
              </View>
            ))}
          </View>
          <Sparkline samples={spark('cpu.util_pct', 40)} width={290} height={26} />
        </MediumFrame>
      );
    case 'md-temp-chart':
      return (
        <MediumFrame>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Eyebrow>SOC TEMPERATURE · 1H</Eyebrow>
            <Metric v={fmtTemp(temp)} unit="°C" size={15} />
          </View>
          <View style={{ flex: 1, justifyContent: 'flex-end' }}>
            <Sparkline samples={spark('cpu.temp_c', 48)} width={290} height={78} color={thermal} />
          </View>
        </MediumFrame>
      );
    case 'md-net-chart':
      return (
        <MediumFrame>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Eyebrow>NETWORK · 1H</Eyebrow>
            <Text style={{ fontFamily: mono, fontSize: 12, color: c.text.secondary, fontVariant: ['tabular-nums'] }}>
              ↓ {rx.value} {rx.unit}   ↑ {tx.value} {tx.unit}
            </Text>
          </View>
          <View style={{ flex: 1, justifyContent: 'center', gap: 4 }}>
            <Sparkline samples={spark('net.rx_bps', 48)} width={290} height={34} />
            <Sparkline samples={spark('net.tx_bps', 48)} width={290} height={34} color={c.viz.categorical[1]} />
          </View>
        </MediumFrame>
      );
    case 'md-quad':
      return (
        <MediumFrame>
          <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap' }}>
            {[
              ['CPU', `${fmtPct(cpu)}`, '%'],
              ['SOC TEMP', fmtTemp(temp), '°C'],
              ['MEMORY', `${fmtPct(memPct)}`, '%'],
              ['LOAD 1M', load.toFixed(2), ''],
            ].map(([k, v, u]) => (
              <View key={k} style={{ width: '50%', height: '50%', justifyContent: 'center' }}>
                <Eyebrow>{k}</Eyebrow>
                <Metric v={v} unit={u || undefined} size={22} />
              </View>
            ))}
          </View>
        </MediumFrame>
      );
    case 'md-status-spark':
      return (
        <MediumFrame>
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.status.ok }} />
                <Eyebrow color={c.status.ok}>ONLINE</Eyebrow>
              </View>
              <Text style={{ fontSize: 16, fontWeight: '600', color: c.text.primary, marginTop: 6 }} numberOfLines={1}>
                {agentName}
              </Text>
              <Text style={{ fontSize: 11, color: c.text.tertiary, marginTop: 2 }}>direct · 34 ms · up {up}</Text>
            </View>
            <View>
              <Metric v={fmtPct(cpu)} unit="%" size={26} />
              <Sparkline samples={spark('cpu.util_pct')} width={120} height={30} />
            </View>
          </View>
        </MediumFrame>
      );
    case 'md-graphwall':
      return (
        <MediumFrame>
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            {(
              [
                ['CPU', 'cpu.util_pct', c.viz.categorical[0]],
                ['TEMP', 'cpu.temp_c', c.viz.categorical[1]],
                ['MEM', 'mem.used_pct', c.viz.categorical[2]],
              ] as [string, SeriesKey, string][]
            ).map(([k, key, col]) => (
              <View key={k} style={{ flex: 1 }}>
                <Eyebrow>{k}</Eyebrow>
                <Sparkline samples={spark(key)} width={88} height={64} color={col} />
              </View>
            ))}
          </View>
        </MediumFrame>
      );
    case 'md-terminal':
      return (
        <MediumFrame>
          <View style={{ flex: 1, justifyContent: 'center', gap: 3 }}>
            <Text style={{ fontFamily: mono, fontSize: 11, color: c.terminal.ansi[10] }}>
              pi@{agentName} $ vcgencmd measure_temp
            </Text>
            <Text style={{ fontFamily: mono, fontSize: 11, color: c.terminal.ansi[7] }}>temp={fmtTemp(temp)}'C</Text>
            <Text style={{ fontFamily: mono, fontSize: 11, color: c.terminal.ansi[10] }}>pi@{agentName} $ uptime</Text>
            <Text style={{ fontFamily: mono, fontSize: 11, color: c.terminal.ansi[7] }}>
              up {up}, load {load.toFixed(2)}
            </Text>
            <View style={{ width: 8, height: 13, backgroundColor: c.terminal.cursor }} />
          </View>
        </MediumFrame>
      );
    case 'md-bloom':
      return (
        <MediumFrame noPad>
          <WaveBackground width={318} height={152} variant="violet" />
          <View style={{ flex: 1, padding: 14, justifyContent: 'space-between' }}>
            <View style={{ alignSelf: 'flex-start', backgroundColor: 'rgba(16,16,20,0.7)', borderRadius: 13, paddingHorizontal: 10, paddingVertical: 5 }}>
              <Text style={{ fontSize: 11, fontWeight: '600', color: '#FFFFFF' }}>Pi Connection</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
              <View>
                <Text style={{ fontSize: 16, fontWeight: '700', color: '#FFFFFF' }}>{agentName}</Text>
                <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)' }}>online · direct · 34 ms</Text>
              </View>
              <Metric v={fmtTemp(temp)} unit="°C" size={24} color="#FFFFFF" />
            </View>
          </View>
        </MediumFrame>
      );

    // ---- Lock Circular ----
    case 'ci-temp':
      return <MonoRing pct={((temp - 35) / 50) * 100} label="°C" value={`${Math.round(temp)}`} />;
    case 'ci-cpu':
      return <MonoRing pct={cpu} label="CPU" value={`${Math.round(cpu)}`} />;
    case 'ci-mem':
      return <MonoRing pct={memPct} label="MEM" value={`${Math.round(memPct)}`} />;
    case 'ci-disk':
      return <MonoRing pct={disk} label="DISK" value={`${Math.round(disk)}`} />;
    case 'ci-load':
      return <MonoRing pct={(load / 4) * 100} label="LOAD" value={load.toFixed(1)} />;
    case 'ci-status':
      return (
        <View style={{ width: 76, height: 76, borderRadius: 38, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="server-outline" size={24} color="#FFFFFF" />
          <Text style={{ fontSize: 9, fontWeight: '700', color: '#FFFFFF', marginTop: 2 }}>ON</Text>
        </View>
      );

    // ---- Lock Rectangular ----
    case 're-temp':
      return (
        <LockRect title={`SOC TEMP · ${fmtTemp(temp)}°C`}>
          <MonoSpark samples={spark('cpu.temp_c')} width={148} height={26} />
        </LockRect>
      );
    case 're-cpu':
      return (
        <LockRect title={`CPU · ${fmtPct(cpu)}%`}>
          <MonoSpark samples={spark('cpu.util_pct')} width={148} height={26} />
        </LockRect>
      );
    case 're-net':
      return (
        <LockRect title="NETWORK">
          <Text style={{ fontFamily: mono, fontSize: 15, color: '#FFFFFF', fontVariant: ['tabular-nums'] }}>
            ↓ {rx.value} {rx.unit}  ↑ {tx.value} {tx.unit}
          </Text>
        </LockRect>
      );
    case 're-status':
      return (
        <LockRect title={agentName.toUpperCase()}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#FFFFFF' }} />
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#FFFFFF' }}>Online · 34 ms</Text>
          </View>
        </LockRect>
      );
    case 're-load':
      return (
        <LockRect title="LOAD AVERAGES">
          <Text style={{ fontFamily: mono, fontSize: 15, color: '#FFFFFF', fontVariant: ['tabular-nums'] }}>
            {load.toFixed(2)}  {(load * 0.9).toFixed(2)}  {(load * 0.8).toFixed(2)}
          </Text>
        </LockRect>
      );

    // ---- Lock Inline ----
    case 'in-temp':
      return <InlinePill text={`🌡 ${agentName} · ${fmtTemp(temp)}°C`} />;
    case 'in-cpu':
      return <InlinePill text={`▣ CPU ${fmtPct(cpu)}% · load ${load.toFixed(2)}`} />;
    case 'in-status':
      return <InlinePill text={`● ${agentName} online · 34 ms`} />;
    case 'in-uptime':
      return <InlinePill text={`⏱ up ${up} · ${fmtTemp(temp)}°C`} />;

    default:
      return null;
  }
}

function LockRect({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View
      style={{
        width: 172,
        height: 76,
        borderRadius: 18,
        backgroundColor: 'rgba(255,255,255,0.14)',
        padding: 10,
        justifyContent: 'space-between',
      }}
    >
      <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 0.5, color: 'rgba(255,255,255,0.7)' }} numberOfLines={1}>
        {title}
      </Text>
      {children}
    </View>
  );
}

function InlinePill({ text }: { text: string }) {
  return (
    <View
      style={{
        height: 30,
        borderRadius: 15,
        backgroundColor: 'rgba(255,255,255,0.14)',
        paddingHorizontal: 14,
        alignItems: 'center',
        justifyContent: 'center',
        alignSelf: 'flex-start',
      }}
    >
      <Text style={{ fontSize: 13, fontWeight: '600', color: '#FFFFFF', fontVariant: ['tabular-nums'] }} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
}
