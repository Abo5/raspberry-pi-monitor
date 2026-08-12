// Remote desktop (RDP-style). You control the Pi's OWN cursor — the app draws no
// cursor of its own. Finger drag → moves the Pi's pointer; one tap → left click;
// double tap → right click (the Pi shows its own menu); two-finger pinch → zoom,
// centred on the Pi pointer. The toolbar collapses to a draggable dot after 1.5s.
//
// Input is sent to the agent's WS /input; the live picture comes from WS /screen.
// Real pointer/keys need an input-injection tool on the Pi (installed separately);
// until then the gestures are transmitted but have no effect.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, Animated, Easing, PanResponder, Pressable, Text, View, useWindowDimensions,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useTheme } from '../../theme';
import { useStore } from '../../store/useStore';
import { RemoteKeyboard } from '../../components/RemoteKeyboard';

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const dist = (a: { pageX: number; pageY: number }, b: { pageX: number; pageY: number }) =>
  Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY);

export function RemoteSession() {
  const { c, type } = useTheme();
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const { width: W, height: H } = useWindowDimensions();
  const agentId = route.params?.agentId as string;
  const agent = useStore((s) => s.agents.find((a) => a.id === agentId));
  const ep = useStore((s) => s.endpoints[agentId]);
  const connection = useStore((s) => s.connection);
  const connected = connection.kind === 'connected';

  const [showKeyboard, setShowKeyboard] = useState(false);
  const [showCC, setShowCC] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [loaded, setLoaded] = useState(false); // first MJPEG frame painted

  // The screen is an MJPEG stream rendered by a WebView <img> — the browser
  // engine decodes it natively (no per-frame JS), which is smooth and can't
  // thrash memory. The <img> self-reconnects if the stream drops.
  const screenHtml = useMemo(() => {
    if (!ep) return '';
    const url = `http://${ep.ip}:${ep.port}/screen.mjpeg?token=${encodeURIComponent(ep.token)}`;
    return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<style>html,body{margin:0;height:100%;background:#0A0A0C;overflow:hidden}.w{height:100vh;display:flex;align-items:center;justify-content:center}img{max-width:100%;max-height:100%;display:block}</style></head>
<body><div class="w"><img id="s" src="${url}"
onerror="setTimeout(function(){document.getElementById('s').src='${url}&t='+Date.now()},1500)"></div></body></html>`;
  }, [ep?.ip, ep?.port, ep?.token]);

  // Turn the phone to landscape while viewing the Pi; restore on exit.
  useFocusEffect(
    React.useCallback(() => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => {});
      return () => {
        ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
      };
    }, []),
  );

  // ---- Input channel (WS /input) ----
  const inputWs = useRef<WebSocket | null>(null);
  useEffect(() => {
    if (!ep) return;
    let alive = true;
    let ws: WebSocket | null = null;
    const open = () => {
      ws = new WebSocket(`ws://${ep.ip}:${ep.port}/input?token=${ep.token}`);
      inputWs.current = ws;
      ws.onclose = () => { if (alive) setTimeout(open, 1500); };
      ws.onerror = () => ws?.close();
    };
    open();
    return () => { alive = false; ws?.close(); inputWs.current = null; };
  }, [ep?.ip, ep?.port, ep?.token]);

  const sendInput = (obj: object) => {
    const ws = inputWs.current;
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj));
  };

  // ---- Zoom, centred on where the Pi pointer is (we track what we commanded) ----
  const scale = useRef(new Animated.Value(1)).current;
  const tx = useRef(new Animated.Value(0)).current;
  const ty = useRef(new Animated.Value(0)).current;
  const scaleVal = useRef(1);
  const cur = useRef({ x: 0.5, y: 0.5 }); // normalised Pi-pointer position (0..1)
  const applyZoom = (s: number) => {
    scaleVal.current = s;
    Animated.timing(scale, { toValue: s, duration: 140, useNativeDriver: true }).start();
    Animated.timing(tx, { toValue: (0.5 - cur.current.x) * W * (s - 1), duration: 140, useNativeDriver: true }).start();
    Animated.timing(ty, { toValue: (0.5 - cur.current.y) * H * (s - 1), duration: 140, useNativeDriver: true }).start();
  };

  // ---- Screen gestures → the Pi's pointer ----
  const startT = useRef(0);
  const moved = useRef(false);
  const lastTap = useRef(0);
  const pinchBase = useRef(0);
  const scaleBase = useRef(1);
  const lastMove = useRef({ x: 0, y: 0 }); // last cumulative dx/dy seen
  const pending = useRef({ x: 0, y: 0 });  // accumulated, not-yet-sent delta
  const lastSent = useRef(0);
  const SENS = 2.5; // touchpad sensitivity

  const flushMove = (force?: boolean) => {
    const now = Date.now();
    if (!force && now - lastSent.current < 40) return;
    const dx = Math.round(pending.current.x * SENS);
    const dy = Math.round(pending.current.y * SENS);
    if (dx !== 0 || dy !== 0) {
      sendInput({ t: 'm', dx, dy });
      pending.current = { x: 0, y: 0 };
      lastSent.current = now;
    }
  };

  const screenPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        startT.current = Date.now();
        moved.current = false;
        pinchBase.current = 0;
        lastMove.current = { x: 0, y: 0 };
        pending.current = { x: 0, y: 0 };
      },
      onPanResponderMove: (e, g) => {
        const ts = e.nativeEvent.touches;
        if (ts.length >= 2) {
          const d = dist(ts[0] as any, ts[1] as any);
          if (pinchBase.current === 0) { pinchBase.current = d; scaleBase.current = scaleVal.current; }
          applyZoom(clamp((scaleBase.current * d) / pinchBase.current, 1, 4));
          moved.current = true;
        } else {
          // Send only the DELTA since the last move (wlrctl is relative), throttled.
          const ddx = g.dx - lastMove.current.x;
          const ddy = g.dy - lastMove.current.y;
          lastMove.current = { x: g.dx, y: g.dy };
          pending.current.x += ddx;
          pending.current.y += ddy;
          cur.current = {
            x: clamp(cur.current.x + (ddx * SENS) / W, 0, 1),
            y: clamp(cur.current.y + (ddy * SENS) / H, 0, 1),
          };
          flushMove();
          if (Math.abs(g.dx) + Math.abs(g.dy) > 6) moved.current = true;
        }
      },
      onPanResponderRelease: () => {
        pinchBase.current = 0;
        flushMove(true);
        if (!moved.current && Date.now() - startT.current < 260) {
          const now = Date.now();
          if (now - lastTap.current < 300) {
            lastTap.current = 0;
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            sendInput({ t: 'click', b: 'right' }); // real right-click on the Pi
          } else {
            lastTap.current = now;
            setTimeout(() => {
              if (lastTap.current === now) {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                sendInput({ t: 'click', b: 'left' });
              }
            }, 300);
          }
        }
      },
    }),
  ).current;

  const sendKey = (k: string) => sendInput({ t: 'key', k });

  // ---- Toolbar: one element that animates between a small draggable dot and
  // the 4-button pill. Collapses ~2s after the last interaction. ----
  const DOT = 30;    // small collapsed dot
  const PILLW = 200; // expanded pill width
  const PH = 42;     // expanded pill height
  const EDGE = 6;    // gap from the screen edge
  const anim = useRef(new Animated.Value(1)).current; // 0 = dot, 1 = pill
  const expandedRef = useRef(true);
  const [side, setSide] = useState<'left' | 'right' | 'top' | 'bottom'>('right');
  const collapseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Live screen bounds — read inside PanResponder to avoid a stale closure after
  // a rotation (the responder is created once).
  const dims = useRef({ W, H, it: insets.top, ib: insets.bottom });
  dims.current = { W, H, it: insets.top, ib: insets.bottom };

  const animateTo = (open: boolean) => {
    expandedRef.current = open;
    setExpanded(open);
    Animated.timing(anim, {
      toValue: open ? 1 : 0,
      duration: open ? 240 : 300,
      easing: open ? Easing.out(Easing.back(1.4)) : Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start();
  };
  const keepOpen = () => {
    if (!expandedRef.current) animateTo(true);
    if (collapseTimer.current) clearTimeout(collapseTimer.current);
    collapseTimer.current = setTimeout(() => animateTo(false), 2000);
  };
  useEffect(() => {
    keepOpen();
    return () => { if (collapseTimer.current) clearTimeout(collapseTimer.current); };
  }, []);

  // Draggable centre — we position by centre so it grows/shrinks in place.
  const dotC = useRef(new Animated.ValueXY({ x: W - 44, y: H / 2 })).current;
  const dotPos = useRef({ x: W - 44, y: H / 2 });
  const dotBase = useRef({ x: 0, y: 0 });
  const dotMoved = useRef(false);
  const dotPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !expandedRef.current,
      onMoveShouldSetPanResponder: (_e, g) => !expandedRef.current && Math.abs(g.dx) + Math.abs(g.dy) > 4,
      onPanResponderGrant: () => { dotBase.current = { ...dotPos.current }; dotMoved.current = false; },
      onPanResponderMove: (_e, g) => {
        // Free movement anywhere on the phone screen (kept inside the bezels).
        const { W: w, H: h, it, ib } = dims.current;
        const x = clamp(dotBase.current.x + g.dx, DOT / 2 + EDGE, w - DOT / 2 - EDGE);
        const y = clamp(dotBase.current.y + g.dy, it + DOT / 2 + EDGE, h - ib - DOT / 2 - EDGE);
        dotPos.current = { x, y };
        dotC.setValue({ x, y });
        if (Math.abs(g.dx) + Math.abs(g.dy) > 4) dotMoved.current = true;
      },
      onPanResponderRelease: () => {
        if (!dotMoved.current) { keepOpen(); return; }
        // Snap to the nearest of the four phone edges (AssistiveTouch-style).
        const { W: w, H: h, it, ib } = dims.current;
        const { x, y } = dotPos.current;
        const dl = x, dr = w - x, dt = y - it, db = (h - ib) - y;
        const m = Math.min(dl, dr, dt, db);
        let nx = x, ny = y;
        let s: 'left' | 'right' | 'top' | 'bottom' = 'right';
        if (m === dl) { nx = DOT / 2 + EDGE; s = 'left'; }
        else if (m === dr) { nx = w - DOT / 2 - EDGE; s = 'right'; }
        else if (m === dt) { ny = it + DOT / 2 + EDGE; s = 'top'; }
        else { ny = h - ib - DOT / 2 - EDGE; s = 'bottom'; }
        dotPos.current = { x: nx, y: ny };
        setSide(s);
        Animated.spring(dotC, { toValue: { x: nx, y: ny }, useNativeDriver: true, bounciness: 6, speed: 14 }).start();
      },
    }),
  ).current;

  const zoomStep = () => { keepOpen(); applyZoom(scaleVal.current >= 4 ? 1 : Math.min(4, scaleVal.current + 1)); };

  // Dock to the right edge after a rotation.
  useEffect(() => {
    const x = W - DOT / 2 - EDGE;
    const y = clamp(H / 2, insets.top + DOT / 2 + EDGE, H - insets.bottom - DOT / 2 - EDGE);
    dotPos.current = { x, y };
    dotC.setValue({ x, y });
    setSide('right');
  }, [W, H]);

  // The dot follows the finger (native translate). The pill docks to the dot's
  // edge and scales/fades in (native transforms only → robust).
  const dotTX = Animated.subtract(dotC.x, DOT / 2);
  const dotTY = Animated.subtract(dotC.y, DOT / 2);
  const pillScale = anim.interpolate({ inputRange: [0, 1], outputRange: [0.25, 1] });
  const pillOpacity = anim.interpolate({ inputRange: [0.12, 1], outputRange: [0, 1] });
  const dotOpacity = anim.interpolate({ inputRange: [0, 0.5], outputRange: [1, 0] });
  // Dock the pill against whichever edge the dot snapped to.
  let pillLeft: number;
  let pillTop: number;
  if (side === 'left' || side === 'right') {
    pillLeft = side === 'left' ? EDGE : W - PILLW - EDGE;
    pillTop = clamp(dotPos.current.y - PH / 2, insets.top + EDGE, H - insets.bottom - PH - EDGE);
  } else {
    pillTop = side === 'top' ? insets.top + EDGE : H - insets.bottom - PH - EDGE;
    pillLeft = clamp(dotPos.current.x - PILLW / 2, EDGE, W - PILLW - EDGE);
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#0A0A0C' }}>
      {/* The Pi screen — an MJPEG stream decoded natively by the WebView.
          Zoom/pan transform on the container; gestures come from the overlay. */}
      <Animated.View
        pointerEvents="none"
        style={{ flex: 1, transform: [{ translateX: tx }, { translateY: ty }, { scale }] }}
      >
        {ep ? (
          <WebView
            source={{ html: screenHtml, baseUrl: `http://${ep.ip}:${ep.port}` }}
            style={{ flex: 1, backgroundColor: '#0A0A0C' }}
            originWhitelist={['*']}
            scrollEnabled={false}
            bounces={false}
            javaScriptEnabled
            mixedContentMode="always"
            onLoadEnd={() => setLoaded(true)}
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            androidLayerType="hardware"
          />
        ) : null}
      </Animated.View>

      {/* Transparent gesture layer over the screen (below the toolbar) */}
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} {...screenPan.panHandlers} />

      {/* "Connecting…" until the first frame paints */}
      {!loaded && (
        <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="small" color="#8E8E93" />
          <Text style={[type.callout, { color: '#4A4A54', marginTop: 12 }]}>
            {connected ? 'Loading the screen…' : 'Connecting…'}
          </Text>
        </View>
      )}

      {/* Expanded pill — scales + fades in from the dot (native transforms) */}
      {!showKeyboard && (
        <Animated.View
          pointerEvents={expanded ? 'auto' : 'none'}
          style={{
            position: 'absolute', top: pillTop, left: pillLeft, width: PILLW, height: PH,
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
            borderRadius: PH / 2, backgroundColor: 'rgba(210,210,216,0.94)',
            opacity: pillOpacity,
            transform: [{ scale: pillScale }],
          }}
        >
          <TB icon="search" onPress={zoomStep} />
          <TB icon="grid" filled onPress={() => { keepOpen(); setShowCC(true); }} />
          <TB icon="keypad" onPress={() => setShowKeyboard(true)} />
          <TB icon="close" tint="#C0392B" onPress={() => nav.goBack()} />
        </Animated.View>
      )}

      {/* Collapsed dot — draggable; tap to expand. Visible only while collapsed */}
      {!showKeyboard && (
        <Animated.View
          {...dotPan.panHandlers}
          pointerEvents={expanded ? 'none' : 'auto'}
          style={{
            position: 'absolute', top: 0, left: 0, width: DOT, height: DOT, borderRadius: DOT / 2,
            alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(210,210,216,0.94)',
            opacity: dotOpacity,
            transform: [{ translateX: dotTX }, { translateY: dotTY }],
          }}
        >
          <Ionicons name="ellipsis-horizontal" size={18} color="#1A1A1F" />
        </Animated.View>
      )}

      {/* Keyboard overlay */}
      {showKeyboard && (
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingBottom: insets.bottom }}>
          <RemoteKeyboard onKey={sendKey} onClose={() => { setShowKeyboard(false); keepOpen(); }} />
        </View>
      )}

      {/* Control Center sheet */}
      {showCC && (
        <Pressable style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)' }} onPress={() => setShowCC(false)}>
          <View style={{ position: 'absolute', left: 14, right: 14, bottom: insets.bottom + 14, backgroundColor: 'rgba(24,24,30,0.98)', borderRadius: 22, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', padding: 16 }}>
            <Text style={[type.micro, { color: c.text.tertiary, marginBottom: 12 }]}>CONTROL CENTER · {agent?.name}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              <CC icon="speedometer" label="Monitor" onPress={() => { setShowCC(false); nav.navigate('MonitorTab', { screen: 'Dashboard' }); }} />
              <CC icon="terminal" label="Shell" onPress={() => { setShowCC(false); nav.navigate('ControlTab', { screen: 'Shell' }); }} />
              <CC icon="flash" label="Actions" onPress={() => { setShowCC(false); nav.navigate('ControlTab', { screen: 'Actions' }); }} />
              <CC icon="notifications" label="Alerts" onPress={() => { setShowCC(false); nav.navigate('AlertsTab'); }} />
              <CC icon="pulse" label="Diagnostics" onPress={() => { setShowCC(false); nav.navigate('MonitorTab', { screen: 'Diagnostics' }); }} />
              <CC icon="information-circle" label="About" onPress={() => { setShowCC(false); nav.navigate('AgentDetail', { agentId }); }} />
            </View>
          </View>
        </Pressable>
      )}
    </View>
  );
}

function TB({ icon, onPress, tint, filled }: { icon: keyof typeof Ionicons.glyphMap; onPress: () => void; tint?: string; filled?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        width: 44, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center',
        backgroundColor: filled ? '#1C1C22' : pressed ? 'rgba(0,0,0,0.12)' : 'transparent',
      })}
    >
      <Ionicons name={icon} size={19} color={tint ?? (filled ? '#FFFFFF' : '#1A1A1F')} />
    </Pressable>
  );
}

function CC({ icon, label, onPress, tint }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; tint?: string }) {
  const { type } = useTheme();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ width: '30%', alignItems: 'center', paddingVertical: 14, borderRadius: 16, backgroundColor: pressed ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.05)' })}>
      <Ionicons name={icon} size={24} color={tint ?? '#B9A6FF'} />
      <Text style={[type.footnote, { color: '#FFFFFF', marginTop: 6 }]}>{label}</Text>
    </Pressable>
  );
}
