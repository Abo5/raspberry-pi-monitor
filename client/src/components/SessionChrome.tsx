// App-side chrome around a Raspberry Pi Connect session (the session page itself
// is shown as-is): a "Connecting…" waiting screen that fades out once the page
// has loaded, a floating dock the user can drag anywhere, and a hook that keeps
// the session above the on-screen keyboard.
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Animated, Easing, Keyboard, PanResponder, Pressable, StyleSheet, Text, View, useWindowDimensions,
} from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';

/** Height of the on-screen keyboard while it's showing (0 otherwise). */
export function useKeyboardHeight(): number {
  const [h, setH] = useState(0);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardWillShow', (e) => setH(e.endCoordinates.height));
    const change = Keyboard.addListener('keyboardWillChangeFrame', (e) => setH(e.endCoordinates.height));
    const hide = Keyboard.addListener('keyboardWillHide', () => setH(0));
    return () => { show.remove(); change.remove(); hide.remove(); };
  }, []);
  return h;
}

/** Full-screen waiting screen: a plain, calm spinner + title, and an error state
 *  with a retry action when the session can't be established. */
const WAIT_MESSAGES = [
  'Establishing a secure connection…',
  'Reaching your Raspberry Pi…',
  'Negotiating the screen stream…',
  'Securing the channel…',
  'Waking the desktop…',
  'Almost there — preparing your screen…',
];

export function ConnectingOverlay({
  visible, title, subtitle, error, onCancel, onRetry,
}: {
  visible: boolean;
  title: string;
  subtitle: string;
  error?: string | null;
  onCancel: () => void;
  onRetry?: () => void;
}) {
  const fade = useRef(new Animated.Value(1)).current;
  const [mounted, setMounted] = useState(true);
  const [msgIdx, setMsgIdx] = useState(0);
  const msgOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (visible) { setMounted(true); fade.setValue(1); return; }
    Animated.timing(fade, { toValue: 0, duration: 220, useNativeDriver: true }).start(() => setMounted(false));
  }, [visible, fade]);

  // Rotate through encouraging status lines so the wait feels alive.
  useEffect(() => {
    if (!visible || error) return;
    setMsgIdx(0);
    msgOpacity.setValue(1);
    const t = setInterval(() => {
      Animated.timing(msgOpacity, { toValue: 0, duration: 220, useNativeDriver: true }).start(() => {
        setMsgIdx((i) => (i + 1) % WAIT_MESSAGES.length);
        Animated.timing(msgOpacity, { toValue: 1, duration: 260, useNativeDriver: true }).start();
      });
    }, 2600);
    return () => clearInterval(t);
  }, [visible, error, msgOpacity]);

  if (!mounted) return null;

  return (
    <Animated.View
      pointerEvents={visible ? 'auto' : 'none'}
      style={[StyleSheet.absoluteFill, { backgroundColor: '#000000', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 36, opacity: fade }]}
    >
      {error ? (
        <>
          <Ionicons name="cloud-offline-outline" size={46} color="#E5555D" />
          <Text style={{ color: '#FFFFFF', fontSize: 20, fontWeight: '700', marginTop: 20, textAlign: 'center' }}>Couldn't connect</Text>
          <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, marginTop: 8, textAlign: 'center', lineHeight: 20 }}>{error}</Text>
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 30 }}>
            {onRetry && (
              <Pressable
                onPress={onRetry}
                accessibilityRole="button"
                accessibilityLabel="Try again"
                style={({ pressed }) => ({
                  height: 44, paddingHorizontal: 24, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
                  backgroundColor: pressed ? '#5A47C0' : '#8A6BEA',
                })}
              >
                <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '700' }}>Try again</Text>
              </Pressable>
            )}
            <Pressable
              onPress={onCancel}
              accessibilityRole="button"
              accessibilityLabel="Back"
              style={({ pressed }) => ({
                height: 44, paddingHorizontal: 24, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
                borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
                backgroundColor: pressed ? 'rgba(255,255,255,0.12)' : 'transparent',
              })}
            >
              <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '600' }}>Back</Text>
            </Pressable>
          </View>
        </>
      ) : (
        <>
          <ActivityIndicator size="small" color="#8E8E93" />
          <Text style={{ color: '#FFFFFF', fontSize: 22, fontWeight: '700', marginTop: 24 }}>{title}</Text>
          <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 14, marginTop: 8, textAlign: 'center' }}>{subtitle}</Text>
          <Animated.Text style={{ color: '#C9B8FF', fontSize: 15, fontWeight: '600', marginTop: 24, textAlign: 'center', opacity: msgOpacity, minHeight: 22 }}>
            {WAIT_MESSAGES[msgIdx]}
          </Animated.Text>
          <Pressable
            onPress={onCancel}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
            style={({ pressed }) => ({
              marginTop: 32, paddingHorizontal: 26, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
              borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
              backgroundColor: pressed ? 'rgba(255,255,255,0.12)' : 'transparent',
            })}
          >
            <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 15, fontWeight: '600' }}>Cancel</Text>
          </Pressable>
        </>
      )}
    </Animated.View>
  );
}

export interface DockAction {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  tint?: string;
}

const BUBBLE = 52;
const BTN = 42;
const GAP = 8;
const EDGE = 6;          // distance from the screen edge (kept inset for design)
const IDLE_MS = 3500;    // collapse after this long without a touch
const FADE_MS = 5000;    // fade the idle bubble after this long untouched

type DockSide = 'left' | 'right' | 'top' | 'bottom';

/**
 * Session tools, AssistiveTouch-style:
 *  • collapsed into a small, semi-transparent glass bubble when idle;
 *  • tap it → it expands (spring + staggered buttons) into a bar of tools that
 *    opens toward the middle of the screen; it folds back after a few idle seconds;
 *  • drag it anywhere → on release it snaps to the nearest EDGE (left / right /
 *    top / bottom), always kept a small inset from the rim for design;
 *  • the bar follows the edge it docks to: the device's SHORT edges (charger and
 *    camera ends) hold a vertical column; the long sides hold a horizontal row.
 */
export function EdgeDock({ actions, icon = 'apps', bottomInset = 0 }: { actions: DockAction[]; icon?: keyof typeof Ionicons.glyphMap; bottomInset?: number }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const leftX = insets.left + EDGE;
  const rightX = width - insets.right - EDGE - BUBBLE;
  const topY = insets.top + EDGE;
  const bottomY = height - insets.bottom - bottomInset - EDGE - BUBBLE;

  const [side, setSide] = useState<DockSide>('right');
  const [hEnd, setHEnd] = useState<'left' | 'right'>('right'); // bubble end for horizontal bars
  const [vEnd, setVEnd] = useState<'top' | 'bottom'>('bottom'); // bubble end for vertical bars
  const [expanded, setExpanded] = useState(false);
  const pos = useRef(new Animated.ValueXY({ x: rightX, y: Math.round(height * 0.45) })).current;
  const cur = useRef({ x: rightX, y: Math.round(height * 0.45) });
  // Where the user last put the dock. A keyboard may push it up for a while;
  // when the keyboard goes away the dock glides back here.
  const home = useRef({ x: rightX, y: Math.round(height * 0.45) });
  const open = useRef(new Animated.Value(0)).current;       // 0 collapsed → 1 expanded
  const idleOpacity = useRef(new Animated.Value(1)).current; // idle bubble stays opaque, then fades
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clampX = (x: number) => Math.max(leftX, Math.min(rightX, x));
  const clampY = (y: number) => Math.max(topY, Math.min(bottomY, y));

  const fadeOut = () => {
    Animated.timing(idleOpacity, { toValue: 0.55, duration: 450, useNativeDriver: false }).start();
  };
  const wake = () => {
    Animated.timing(idleOpacity, { toValue: 1, duration: 150, useNativeDriver: false }).start();
  };
  const armFade = () => {
    if (fadeTimer.current) clearTimeout(fadeTimer.current);
    fadeTimer.current = setTimeout(fadeOut, FADE_MS);
  };
  const cancelFade = () => {
    if (fadeTimer.current) clearTimeout(fadeTimer.current);
    fadeTimer.current = null;
  };
  const collapse = () => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = null;
    setExpanded(false);
    // Clear, mirrored recoil: the same back-ease as expand, reversed.
    Animated.timing(open, { toValue: 0, duration: 320, easing: Easing.in(Easing.back(1.7)), useNativeDriver: false }).start();
    wake();
    armFade();
  };
  const armIdle = () => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(collapse, IDLE_MS);
  };
  const expand = () => {
    setExpanded(true);
    cancelFade();
    // Slower pop-out with a visible overshoot (bounce).
    Animated.timing(open, { toValue: 1, duration: 340, easing: Easing.out(Easing.back(1.7)), useNativeDriver: false }).start();
    wake();
    armIdle();
  };
  useEffect(() => {
    armFade(); // the collapsed bubble starts opaque and fades after a few idle seconds
    return () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
      if (fadeTimer.current) clearTimeout(fadeTimer.current);
    };
  }, []);

  // Keep to the current side after rotation / size change, and stay clear of a
  // keyboard: when one opens over the dock it glides up above it, calmly (no
  // bounce, keyboard-like timing), and glides back to where the user left it
  // once the keyboard closes.
  const firstLayout = useRef(true);
  useEffect(() => {
    const x = side === 'left' ? leftX : side === 'right' ? rightX : clampX(home.current.x);
    const y = side === 'top' ? topY : side === 'bottom' ? bottomY : clampY(home.current.y);
    cur.current = { x, y };
    setHEnd(x + BUBBLE / 2 < width / 2 ? 'left' : 'right');
    setVEnd(y + BUBBLE / 2 < height / 2 ? 'top' : 'bottom');
    if (firstLayout.current) {
      firstLayout.current = false;
      pos.setValue(cur.current);
      return;
    }
    Animated.timing(pos, {
      toValue: cur.current,
      duration: 300,
      easing: Easing.bezier(0.25, 0.1, 0.25, 1), // the curve iOS uses for its keyboard
      useNativeDriver: false,
    }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, height, bottomInset]);

  const geo = useRef({ leftX, rightX, topY, bottomY, width, height });
  geo.current = { leftX, rightX, topY, bottomY, width, height };
  const clampRef = useRef({ clampX, clampY });
  clampRef.current = { clampX, clampY };
  const expandedRef = useRef(expanded);
  expandedRef.current = expanded;

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) + Math.abs(g.dy) > 6,
      onPanResponderGrant: () => {
        cancelFade();
        wake();
      },
      onPanResponderMove: (_, g) => {
        // Movable open or closed. While open, hold the auto-close until released.
        if (expandedRef.current && idleTimer.current) {
          clearTimeout(idleTimer.current);
          idleTimer.current = null;
        }
        pos.setValue({ x: cur.current.x + g.dx, y: cur.current.y + g.dy });
      },
      onPanResponderRelease: (_, g) => {
        const moved = Math.abs(g.dx) + Math.abs(g.dy) > 6;
        if (!moved) {
          if (expandedRef.current) collapse(); else expand();
          return;
        }
        // Snap to the nearest of the four edges, kept inset from the rim.
        const { leftX: lx, rightX: rx, topY: ty, bottomY: by, width: w, height: hh } = geo.current;
        const cx = cur.current.x + g.dx;
        const cy = cur.current.y + g.dy;
        const dl = cx - lx, dr = rx - cx, dt = cy - ty, db = by - cy;
        const m = Math.min(dl, dr, dt, db);
        let nx = cx, ny = cy;
        let next: DockSide = 'right';
        if (m === dl) { nx = lx; next = 'left'; }
        else if (m === dr) { nx = rx; next = 'right'; }
        else if (m === dt) { ny = ty; next = 'top'; }
        else { ny = by; next = 'bottom'; }
        if (next === 'left' || next === 'right') ny = clampRef.current.clampY(ny);
        else nx = clampRef.current.clampX(nx);
        cur.current = { x: nx, y: ny };
        home.current = { x: nx, y: ny };
        setSide(next);
        // Remember which half the bubble sits in, so the bar opens toward the
        // free space on both axes (needed after orientation flips short/long).
        setHEnd(nx + BUBBLE / 2 < w / 2 ? 'left' : 'right');
        setVEnd(ny + BUBBLE / 2 < hh / 2 ? 'top' : 'bottom');
        Animated.spring(pos, { toValue: cur.current, useNativeDriver: false, friction: 7, tension: 60 }).start();
        // Still open → restart the auto-close countdown; closed → fade as usual.
        if (expandedRef.current) armIdle(); else armFade();
      },
    }),
  ).current;

  // Left/right edges hold a VERTICAL column; top/bottom edges hold a HORIZONTAL
  // row. In GUI (landscape) left/right are the short charger/camera ends; in SSH
  // (portrait) they are the long sides — i.e. the opposite expansion for SSH.
  const vertical = side === 'left' || side === 'right';
  const growLeft = hEnd === 'right'; // horizontal bars open toward the free space
  const barSize = actions.length * (BTN + GAP) + GAP;
  // Vertical bars open toward the free space — and never down over a keyboard:
  // if the column wouldn't fit above the keyboard (or screen bottom), open up.
  const roomBelow = height - insets.bottom - bottomInset - EDGE - (cur.current.y + BUBBLE);
  const growUp = vEnd === 'bottom' || roomBelow < barSize;
  const barExtent = open.interpolate({ inputRange: [0, 1], outputRange: [0, barSize], extrapolate: 'clamp' });

  const bar = (
    <Animated.View
      style={vertical
        ? { width: BUBBLE, height: barExtent, overflow: 'hidden', flexDirection: growUp ? 'column-reverse' as const : 'column' as const, alignItems: 'center' }
        : { width: barExtent, height: BUBBLE, overflow: 'hidden', flexDirection: growLeft ? 'row-reverse' : 'row', alignItems: 'center' }}
    >
      {actions.map((a, i) => {
        // Stagger: buttons pop in one after another from the bubble outward.
        const start = Math.min(0.85, i / (actions.length + 1));
        const t = open.interpolate({ inputRange: [start, Math.min(1, start + 0.35)], outputRange: [0, 1], extrapolate: 'clamp' });
        return (
          <Animated.View key={a.label} style={{ marginHorizontal: vertical ? 0 : GAP / 2, marginVertical: vertical ? GAP / 2 : 0, opacity: t, transform: [{ scale: t }] }}>
            <Pressable
              onPress={() => { a.onPress(); armIdle(); }}
              accessibilityRole="button"
              accessibilityLabel={a.label}
              style={({ pressed }) => ({
                width: BTN, height: BTN, borderRadius: BTN / 2,
                alignItems: 'center', justifyContent: 'center',
                backgroundColor: pressed ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.10)',
                borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
              })}
            >
              <Ionicons name={a.icon} size={19} color={a.tint ?? '#FFFFFF'} />
            </Pressable>
          </Animated.View>
        );
      })}
    </Animated.View>
  );

  // The dock grows from the bubble toward the middle of the screen: a right-end
  // bar shifts left by its width; a bottom-end (vertical) bar shifts up by its height.
  const shiftX = !vertical && growLeft ? Animated.multiply(barExtent, -1) : 0;
  const shiftY = vertical && growUp ? Animated.multiply(barExtent, -1) : 0;

  const bubbleEl = (
    <View
      {...responder.panHandlers}
      accessibilityRole="button"
      accessibilityLabel={expanded ? 'Close tools' : 'Open tools'}
      style={{ width: BUBBLE, height: BUBBLE, alignItems: 'center', justifyContent: 'center' }}
    >
      {/* No close (✕) state: the bubble keeps its icon and the tools fold away on their own. */}
      <Ionicons name={icon} size={24} color="#FFFFFF" />
    </View>
  );

  return (
    <Animated.View
      pointerEvents="box-none"
      style={{
        position: 'absolute', left: 0, top: 0,
        transform: [{ translateX: Animated.add(pos.x, shiftX as any) }, { translateY: Animated.add(pos.y, shiftY as any) }],
        opacity: idleOpacity,
      }}
    >
      <View
        style={{
          ...(vertical ? { width: BUBBLE } : { height: BUBBLE }),
          borderRadius: BUBBLE / 2, overflow: 'hidden',
          flexDirection: vertical ? 'column' : growLeft ? 'row' : 'row-reverse', alignItems: 'center',
          borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', backgroundColor: 'rgba(20,18,28,0.5)',
          shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 6 },
        }}
      >
        <BlurView intensity={55} tint="dark" style={StyleSheet.absoluteFill} />
        {vertical && !growUp && bubbleEl}
        {bar}
        {(!vertical || growUp) && bubbleEl}
      </View>
    </Animated.View>
  );
}

export type KeyMod = 'Ctrl' | 'Shift' | 'Alt';

/** The Raspberry Pi keyboard's raspberry key (Super / Windows key). */
function RaspberryGlyph({ size = 18, color = '#FFFFFF' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M8 3.5c1.6.2 3 .9 4 2 1-1.1 2.4-1.8 4-2-.3 1.6-1.4 2.8-2.8 3.4H10.8C9.4 6.3 8.3 5.1 8 3.5z" fill="#3DDC84" />
      <Circle cx="12" cy="11" r="2.6" fill={color} />
      <Circle cx="8" cy="12.6" r="2.4" fill={color} />
      <Circle cx="16" cy="12.6" r="2.4" fill={color} />
      <Circle cx="9.6" cy="16.8" r="2.4" fill={color} />
      <Circle cx="14.4" cy="16.8" r="2.4" fill={color} />
      <Circle cx="12" cy="20" r="2" fill={color} />
    </Svg>
  );
}

export const KEY_BAR_HEIGHT = 50;

type BarPage = 'keys' | 'fn' | 'nav';
const NEXT_PAGE: Record<BarPage, { page: BarPage; label: string }> = {
  keys: { page: 'fn', label: 'Fn' },
  fn: { page: 'nav', label: 'Nav' },
  nav: { page: 'keys', label: 'Keys' },
};
// Keys that repeat while held, like on a real keyboard.
const REPEATS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Backspace', 'Delete', 'PageUp', 'PageDown']);

/**
 * The rest of the keyboard the iPhone doesn't have, on three pages:
 *  • Keys — Esc, Tab, Ctrl, Shift, Alt, the Raspberry (Super) key, arrows
 *  • Fn   — F1 … F12
 *  • Nav  — Home, End, PgUp, PgDn, Insert, Delete, Backspace, Enter, PrtSc, Ctrl+Alt+Del
 * plus Paste, always at the end. Ctrl/Shift/Alt are one-shot and stay armed
 * across pages (Ctrl → Fn → F5 = Ctrl+F5). Arrows and delete keys repeat while held.
 */
export function SessionKeyBar({
  bottom, mods, onToggleMod, onKey, onCombo, onPaste,
}: {
  bottom: number;
  mods: KeyMod[];
  onToggleMod: (m: KeyMod) => void;
  onKey: (key: string) => void;
  onCombo: (mods: KeyMod[], key: string) => void;
  onPaste: () => void;
}) {
  const [page, setPage] = useState<BarPage>('keys');
  const repeat = useRef<{ delay?: ReturnType<typeof setTimeout>; every?: ReturnType<typeof setInterval> }>({});
  const stopRepeat = () => {
    if (repeat.current.delay) clearTimeout(repeat.current.delay);
    if (repeat.current.every) clearInterval(repeat.current.every);
    repeat.current = {};
  };
  useEffect(() => stopRepeat, []);

  const key = (label: React.ReactNode, onPress: () => void, a11y: string, opts: { active?: boolean; holdKey?: string; tint?: string } = {}) => (
    <Pressable
      key={a11y}
      // Repeating keys fire on touch-down, then repeat while held.
      onPress={opts.holdKey ? undefined : onPress}
      onPressIn={opts.holdKey ? () => {
        stopRepeat();
        const k = opts.holdKey!;
        onKey(k);
        repeat.current.delay = setTimeout(() => { repeat.current.every = setInterval(() => onKey(k), 70); }, 400);
      } : undefined}
      onPressOut={opts.holdKey ? stopRepeat : undefined}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityState={{ selected: !!opts.active }}
      hitSlop={3}
      // Equal widths across the row: every key stays on screen, even in portrait.
      style={({ pressed }) => ({
        flex: 1, minWidth: 0, height: 36, paddingHorizontal: 1, borderRadius: 8,
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: opts.active ? '#8A6BEA' : pressed ? 'rgba(255,255,255,0.28)' : opts.tint ?? 'rgba(255,255,255,0.12)',
        borderWidth: 1, borderColor: opts.active ? '#B9A6FF' : 'rgba(255,255,255,0.10)',
      })}
    >
      {typeof label === 'string' ? (
        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '600' }}>{label}</Text>
      ) : label}
    </Pressable>
  );
  const plain = (k: string, label: string, a11y = label) => key(label, () => onKey(k), a11y, { holdKey: REPEATS.has(k) ? k : undefined });
  const icon = (k: string, name: keyof typeof Ionicons.glyphMap, a11y: string) =>
    key(<Ionicons name={name} size={17} color="#FFFFFF" />, () => onKey(k), a11y, { holdKey: REPEATS.has(k) ? k : undefined });
  const mod = (m: KeyMod) => key(m, () => onToggleMod(m), m, { active: mods.includes(m) });

  const next = NEXT_PAGE[page];
  return (
    <View
      style={{
        position: 'absolute', left: 0, right: 0, bottom, height: KEY_BAR_HEIGHT,
        borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.18)', backgroundColor: 'rgba(20,18,28,0.6)',
      }}
    >
      <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 5, height: KEY_BAR_HEIGHT }}>
        {key(next.label, () => { stopRepeat(); setPage(next.page); }, `Show ${next.label} keys`, { tint: 'rgba(138,107,234,0.35)' })}
        {page === 'keys' && (
          <>
            {plain('Escape', 'Esc')}
            {plain('Tab', 'Tab')}
            {mod('Ctrl')}
            {mod('Shift')}
            {mod('Alt')}
            {key(<RaspberryGlyph />, () => onKey('Super'), 'Raspberry key')}
            {icon('ArrowLeft', 'chevron-back', 'Left arrow')}
            {icon('ArrowUp', 'chevron-up', 'Up arrow')}
            {icon('ArrowDown', 'chevron-down', 'Down arrow')}
            {icon('ArrowRight', 'chevron-forward', 'Right arrow')}
          </>
        )}
        {page === 'fn' && Array.from({ length: 12 }, (_, i) => plain(`F${i + 1}`, `F${i + 1}`))}
        {page === 'nav' && (
          <>
            {plain('Home', 'Home')}
            {plain('End', 'End')}
            {plain('PageUp', 'PgUp', 'Page up')}
            {plain('PageDown', 'PgDn', 'Page down')}
            {plain('Insert', 'Ins', 'Insert')}
            {plain('Delete', 'Del', 'Delete')}
            {icon('Backspace', 'backspace-outline', 'Backspace')}
            {icon('Enter', 'return-down-back', 'Enter')}
            {plain('PrintScreen', 'PrtSc', 'Print screen')}
            {key('C+A+Del', () => onCombo(['Ctrl', 'Alt'], 'Delete'), 'Control Alt Delete')}
          </>
        )}
        {key(<Ionicons name="clipboard-outline" size={17} color="#FFFFFF" />, onPaste, 'Paste')}
      </View>
    </View>
  );
}
