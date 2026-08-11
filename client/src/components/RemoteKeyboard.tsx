// A real-keyboard-style remote keyboard for the RDP session, styled after the
// device keyboard (dark, light rounded keycaps). Sends the logical key name via
// onKey; Ctrl/Alt/Shift/Super latch so you can build combos. Function row (F1–F12)
// is kept for remote-desktop needs.
import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../theme';

type Key = { label: string; out?: string; w?: number; wide?: boolean; kind?: 'key' | 'mod' | 'act' | 'fn' };

const FN: Key[] = [
  { label: 'esc', out: 'Escape', kind: 'fn' },
  ...Array.from({ length: 12 }, (_, i) => ({ label: `F${i + 1}`, kind: 'fn' as const })),
];
const ROWS: Key[][] = [
  [{ label: '`' }, ...'1234567890'.split('').map((l) => ({ label: l })), { label: '-' }, { label: '=' },
   { label: '⌫', out: 'BackSpace', w: 1.6, kind: 'act' }],
  [{ label: 'tab', out: 'Tab', w: 1.4, kind: 'act' }, ...'qwertyuiop'.split('').map((l) => ({ label: l })),
   { label: '[' }, { label: ']' }, { label: '\\', w: 1.1 }],
  [{ label: 'caps', out: 'Caps_Lock', w: 1.7, kind: 'act' }, ...'asdfghjkl'.split('').map((l) => ({ label: l })),
   { label: ';' }, { label: "'" }, { label: 'return', out: 'Return', w: 1.9, kind: 'act' }],
  [{ label: 'shift', out: 'Shift', w: 2.1, kind: 'mod' }, ...'zxcvbnm'.split('').map((l) => ({ label: l })),
   { label: ',' }, { label: '.' }, { label: '/' }, { label: 'shift', out: 'Shift', w: 2.1, kind: 'mod' }],
  [{ label: 'ctrl', out: 'Ctrl', w: 1.3, kind: 'mod' }, { label: 'alt', out: 'Alt', w: 1.3, kind: 'mod' },
   { label: '⌘', out: 'Super', w: 1.3, kind: 'mod' }, { label: 'space', out: ' ', w: 6, kind: 'act' },
   { label: '←', out: 'Left', kind: 'act' }, { label: '↑', out: 'Up', kind: 'act' },
   { label: '↓', out: 'Down', kind: 'act' }, { label: '→', out: 'Right', kind: 'act' }],
];

export function RemoteKeyboard({ onKey, onClose }: { onKey: (k: string) => void; onClose: () => void }) {
  const { c, type } = useTheme();
  const [sticky, setSticky] = useState<Record<string, boolean>>({});

  const press = (k: Key) => {
    Haptics.selectionAsync();
    const out = k.out ?? k.label;
    if (k.kind === 'mod') {
      setSticky((s) => ({ ...s, [out]: !s[out] }));
      return;
    }
    const mods = Object.entries(sticky).filter(([, on]) => on).map(([m]) => m);
    onKey(mods.length ? `${mods.join('+')}+${out}` : out);
    if (mods.length) setSticky({});
  };

  const Cap = ({ k, h = 44, fn }: { k: Key; h?: number; fn?: boolean }) => {
    const modOn = k.kind === 'mod' && sticky[k.out ?? k.label];
    const bg = modOn ? c.accent.base : k.kind === 'act' || k.kind === 'mod' ? '#3A3A3C' : fn ? '#2E2E30' : '#575759';
    return (
      <Pressable
        onPress={() => press(k)}
        style={({ pressed }) => ({
          flex: k.w ?? 1,
          height: h,
          marginHorizontal: 2.5,
          borderRadius: 6,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: pressed ? c.accent.base : bg,
          borderBottomWidth: 1,
          borderBottomColor: 'rgba(0,0,0,0.35)',
        })}
      >
        <Text style={[type.body, { color: '#FFFFFF', fontSize: fn ? 11 : k.label.length > 1 ? 12 : 17 }]}>
          {k.label}
        </Text>
      </Pressable>
    );
  };

  const Row = ({ keys, h }: { keys: Key[]; h?: number }) => (
    <View style={{ flexDirection: 'row', marginBottom: 5 }}>
      {keys.map((k, i) => <Cap key={`${k.label}-${i}`} k={k} h={h} fn={k.kind === 'fn'} />)}
    </View>
  );

  return (
    <View style={{ backgroundColor: '#1C1C1E', paddingTop: 6, paddingHorizontal: 4, paddingBottom: 8, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)' }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 6, marginBottom: 6 }}>
        <Text style={[type.micro, { color: c.text.tertiary }]}>KEYBOARD</Text>
        <Pressable onPress={onClose} hitSlop={12} style={{ paddingHorizontal: 10, paddingVertical: 2 }}>
          <Text style={[type.footnote, { color: c.accent.high, fontWeight: '700' }]}>Hide</Text>
        </Pressable>
      </View>
      <Row keys={FN} h={30} />
      {ROWS.map((row, i) => <Row key={i} keys={row} h={44} />)}
    </View>
  );
}
