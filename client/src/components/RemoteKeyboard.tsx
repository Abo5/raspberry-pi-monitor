// A real-keyboard-style remote keyboard for the RDP session, styled after the
// device keyboard (dark, light rounded keycaps). Sends the logical key name via
// onKey; Ctrl/Alt/Shift/Super latch so you can build combos. Function row (F1–F12)
// is kept for remote-desktop needs.
import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../theme';

type Key = { label: string; out?: string; w?: number; wide?: boolean; kind?: 'key' | 'mod' | 'act' | 'fn' | 'layer' };

const FN: Key[] = [
  { label: 'esc', out: 'Escape', kind: 'fn' },
  ...Array.from({ length: 12 }, (_, i) => ({ label: `F${i + 1}`, kind: 'fn' as const })),
];
const LETTER_ROWS: Key[][] = [
  [{ label: '`' }, ...'1234567890'.split('').map((l) => ({ label: l })), { label: '-' }, { label: '=' },
   { label: '⌫', out: 'BackSpace', w: 1.6, kind: 'act' }],
  [{ label: 'tab', out: 'Tab', w: 1.4, kind: 'act' }, ...'qwertyuiop'.split('').map((l) => ({ label: l })),
   { label: '[' }, { label: ']' }, { label: '\\', w: 1.1 }],
  [{ label: 'caps', out: 'Caps_Lock', w: 1.7, kind: 'act' }, ...'asdfghjkl'.split('').map((l) => ({ label: l })),
   { label: ';' }, { label: "'" }, { label: 'return', out: 'Return', w: 1.9, kind: 'act' }],
  [{ label: 'shift', out: 'Shift', w: 2.1, kind: 'mod' }, ...'zxcvbnm'.split('').map((l) => ({ label: l })),
   { label: ',' }, { label: '.' }, { label: '/' }, { label: 'shift', out: 'Shift', w: 2.1, kind: 'mod' }],
];

const SYM_ROWS: Key[][] = [
  [{ label: '~' }, { label: '!' }, { label: '@' }, { label: '#' }, { label: '$' }, { label: '%' }, { label: '^' }, { label: '&' }, { label: '*' }, { label: '(' }, { label: ')' }, { label: '⌫', out: 'BackSpace', w: 1.4, kind: 'act' }],
  [{ label: '`' }, { label: '-' }, { label: '_' }, { label: '=' }, { label: '+' }, { label: '{' }, { label: '}' }, { label: '[' }, { label: ']' }, { label: '|' }, { label: '\\', w: 1.2 }],
  [{ label: ':' }, { label: ';' }, { label: '"' }, { label: "'" }, { label: '<' }, { label: '>' }, { label: '?' }, { label: '/' }, { label: '.' }, { label: ',' }, { label: 'return', out: 'Return', w: 1.6, kind: 'act' }],
];

export function RemoteKeyboard({ onKey, large = false }: { onKey: (k: string) => void; large?: boolean }) {
  const { c, type } = useTheme();
  const [sticky, setSticky] = useState<Record<string, boolean>>({});
  const [layer, setLayer] = useState<'abc' | 'sym'>('abc');

  const CAP_H = large ? 44 : 28;
  const FN_H = large ? 30 : 22;
  const MARGIN_X = large ? 2.5 : 1.5;
  const ROW_MB = large ? 5 : 3;

  const press = (k: Key) => {
    Haptics.selectionAsync();
    if (k.kind === 'layer') {
      setLayer((l) => (l === 'abc' ? 'sym' : 'abc'));
      return;
    }
    const out = k.out ?? k.label;
    if (k.kind === 'mod') {
      setSticky((s) => ({ ...s, [out]: !s[out] }));
      return;
    }
    const mods = Object.entries(sticky).filter(([, on]) => on).map(([m]) => m);
    onKey(mods.length ? `${mods.join('+')}+${out}` : out);
    if (mods.length) setSticky({});
  };

  const Cap = ({ k, h, fn }: { k: Key; h?: number; fn?: boolean }) => {
    const modOn = k.kind === 'mod' && sticky[k.out ?? k.label];
    const layerOn = k.kind === 'layer' && layer === 'sym';
    const bg = modOn || layerOn ? c.accent.base : k.kind === 'act' || k.kind === 'mod' || k.kind === 'layer' ? '#3A3A3C' : fn ? '#2E2E30' : '#575759';
    const fs = fn ? (large ? 11 : 9) : k.label.length > 1 ? (large ? 12 : 10) : (large ? 17 : 13);
    return (
      <Pressable
        onPress={() => press(k)}
        style={({ pressed }) => ({
          flex: k.w ?? 1,
          height: h ?? CAP_H,
          marginHorizontal: MARGIN_X,
          borderRadius: large ? 6 : 5,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: pressed ? c.accent.base : bg,
          borderBottomWidth: 1,
          borderBottomColor: 'rgba(0,0,0,0.35)',
        })}
      >
        <Text style={[type.body, { color: '#FFFFFF', fontSize: fs }]}>
          {k.label}
        </Text>
      </Pressable>
    );
  };

  const Row = ({ keys, h }: { keys: Key[]; h?: number }) => (
    <View style={{ flexDirection: 'row', marginBottom: ROW_MB }}>
      {keys.map((k, i) => <Cap key={`${k.label}-${i}`} k={k} h={h} fn={k.kind === 'fn'} />)}
    </View>
  );

  return (
    <View style={{ backgroundColor: '#1C1C1E', paddingTop: large ? 6 : 4, paddingHorizontal: large ? 4 : 3, paddingBottom: large ? 8 : 5, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)' }}>
      <Row keys={FN} h={FN_H} />
      {(layer === 'abc' ? LETTER_ROWS : SYM_ROWS).map((row, i) => <Row key={`${layer}-${i}`} keys={row} h={CAP_H} />)}
      <Row
        keys={[
          { label: layer === 'abc' ? '?123' : 'ABC', kind: 'layer', w: 1.6 },
          { label: 'ctrl', out: 'Ctrl', w: 1.1, kind: 'mod' },
          { label: 'alt', out: 'Alt', w: 1.1, kind: 'mod' },
          { label: 'Win', out: 'Super', w: 1.4, kind: 'mod' },
          { label: 'space', out: ' ', w: 4.1, kind: 'act' },
          { label: '←', out: 'Left', kind: 'act' },
          { label: '↑', out: 'Up', kind: 'act' },
          { label: '↓', out: 'Down', kind: 'act' },
          { label: '→', out: 'Right', kind: 'act' },
        ]}
        h={CAP_H}
      />
    </View>
  );
}
