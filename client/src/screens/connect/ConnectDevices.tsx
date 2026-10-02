// The account's Raspberry Pi Connect devices, shown after sign-in. Served by
// connect.raspberrypi.com inside an authenticated WebView with native chrome:
// tapping a device opens it (desktop / screen sharing); the SSH button jumps to
// that device's in-browser terminal; the ⋯ menu reloads, opens in Safari, or
// signs out. If the session expires, it drops back to the devices home.
import React, { useEffect, useRef, useState } from 'react';
import { ActionSheetIOS, ActivityIndicator, Keyboard, Linking, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import { useTheme } from '../../theme';
import { useStore } from '../../store/useStore';
import { ConnectWebView } from '../../components/ConnectWebView';
import { ConnectingOverlay, EdgeDock, useKeyboardHeight } from '../../components/SessionChrome';
import { signOutOfConnect } from '../../net/connectCookies';
import { useBiometricGate } from '../../lib/biometric';
import {
  CONNECT_ORIGIN, CONNECT_URLS, DEVICE_SCREEN_SUFFIX, DEVICE_SSH_SUFFIX, SESSION_CHROME_JS, SNAPSHOT_JS, classifyUrl,
} from '../../net/connect';

export function ConnectDevices() {
  const { c, type } = useTheme();
  const insets = useSafeAreaInsets();
  const nav = useNavigation<any>();
  // Opened from a device card: go straight to that device (GUI) or its SSH shell.
  const params = (useRoute<any>().params ?? {}) as { url?: string; title?: string; mode?: 'gui' | 'ssh' };
  const deviceBase = params.url?.replace(/\/$/, '');
  const startUrl = deviceBase
    ? `${deviceBase}${params.mode === 'ssh' ? DEVICE_SSH_SUFFIX : DEVICE_SCREEN_SUFFIX}`
    : CONNECT_URLS.devices;
  const inSession = !!deviceBase;

  // Face ID (when the user turned it on in Settings › Security) before a live
  // desktop / shell opens. Nothing loads until it passes; cancel leaves.
  const unlocked = useBiometricGate(inSession, `Open ${params.mode === 'ssh' ? 'a shell' : 'the desktop'} on ${params.title ?? 'your Pi'}`);

  // Orientation (landscape for GUI only) is handled centrally in navigation.
  useEffect(() => {
    if (!inSession || !unlocked) return;
    useStore.getState().set({ connectSessionActive: true });
    return () => useStore.getState().set({ connectSessionActive: false });
  }, [inSession, unlocked]);
  const email = useStore((s) => s.connectEmail);
  const setConnectAuth = useStore((s) => s.setConnectAuth);

  const webRef = useRef<WebView>(null);
  const [loading, setLoading] = useState(true);
  const [canGoBack, setCanGoBack] = useState(false);
  const [device, setDevice] = useState<{ id?: string; name?: string }>({});
  const [connecting, setConnecting] = useState(true);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const revealTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (revealTimer.current) clearTimeout(revealTimer.current); }, []);
  const kbHeight = useKeyboardHeight();

  // Native keyboard host: a real (hidden) RN TextInput. Focusing a native field
  // raises the FULL system keyboard (WKWebView programmatic focus on Connect's
  // hidden textarea raised it "minimized" instead). We forward each key to the
  // session page: printable text via __pimonInsertText (an `input` event), and
  // special keys via __pimonSendKey (keydown/keyup).
  const kbRef = useRef<TextInput>(null);
  const kbLast = useRef('');

  const onUrl = (url: string) => {
    const state = classifyUrl(url);
    if (state === 'signedIn') {
      setConnectAuth(true, undefined);
    } else if (state === 'signedOut') {
      setConnectAuth(false, null);
      // In a live session, an expired session means "sign in again" — never the
      // "Couldn't connect" error (that error is only for a reachable-but-broken
      // device). Send the user straight to sign-in.
      if (inSession) {
        if (revealTimer.current) clearTimeout(revealTimer.current);
        setConnecting(false);
        nav.replace('ConnectLogin');
      }
    }
  };

  const onMessage = (e: any) => {
    try {
      const msg = JSON.parse(e.nativeEvent.data) as { type?: string; email?: string; deviceId?: string; deviceName?: string; message?: string };
      if (msg?.type === 'snapshot' && deviceBase && typeof (msg as any).data === 'string') {
        const s = useStore.getState();
        s.set({ deviceSnapshots: { ...s.deviceSnapshots, [deviceBase]: (msg as any).data } });
        return;
      }
      if (msg?.type === 'session-ready') { if (revealTimer.current) clearTimeout(revealTimer.current); setConnecting(false); setSessionError(null); return; }
      if (msg?.type === 'session-error') { if (revealTimer.current) clearTimeout(revealTimer.current); setSessionError(msg.message || "The device didn't answer."); return; }
      if (msg?.type !== 'connect') return;
      if (msg.email && msg.email !== email) setConnectAuth(true, msg.email);
      setDevice(msg.deviceId ? { id: msg.deviceId, name: msg.deviceName } : {});
    } catch {}
  };

  const openSsh = () => {
    if (!device.id) return;
    webRef.current?.injectJavaScript(
      `window.location.href=${JSON.stringify(`${CONNECT_ORIGIN}/devices/${device.id}${DEVICE_SSH_SUFFIX}`)}; true;`,
    );
  };

  // Typing uses the iPhone's native keyboard: tapping the remote screen focuses
  // Connect's hidden keyboardInput textarea and the system keyboard appears.

  const retrySession = () => {
    setSessionError(null);
    setConnecting(true);
    webRef.current?.reload();
  };

  // Raise the native keyboard by focusing a real (hidden) RN TextInput — this
  // gives the FULL system keyboard, unlike programmatic focus on Connect's own
  // hidden textarea, which iOS raised only as a sliver.
  const openKeyboard = () => {
    kbRef.current?.focus();
  };
  // Hide it again — ours, or the one Connect's own field raised on a screen tap.
  const hideKeyboard = () => {
    kbRef.current?.blur();
    Keyboard.dismiss();
    webRef.current?.injectJavaScript('window.__pimonHideKeyboard && window.__pimonHideKeyboard(); true;');
  };

  // Leaving a session: drop the keyboard and take the live screen down FIRST
  // (unmounting the WebView also ends the stream), then leave on a black frame.
  // Popping straight away left the remote screen visible — stretched by the
  // rotation back to portrait — while the session was still closing.
  const [closing, setClosing] = useState(false);
  const isGui = inSession && params.mode !== 'ssh';
  const takeSnapshot = () => webRef.current?.injectJavaScript(SNAPSHOT_JS);
  const closeSession = () => {
    if (closing) return;
    hideKeyboard();
    if (revealTimer.current) clearTimeout(revealTimer.current);
    // Last picture of the desktop for the device card, then leave.
    const live = isGui && !connecting;
    if (live) takeSnapshot();
    setTimeout(() => {
      setClosing(true);
      setTimeout(() => { if (nav.canGoBack()) nav.goBack(); }, 60);
    }, live ? 250 : 0);
  };
  // Keep a fresh picture while the desktop is up, so any way out (or the app
  // going to the background) still leaves a recent one on the card.
  useEffect(() => {
    if (!isGui || connecting || closing) return;
    takeSnapshot();
    const t = setInterval(takeSnapshot, 8000);
    return () => clearInterval(t);
  }, [isGui, connecting, closing]);

  // Forward typed text (printable chars) into the session page.
  const forwardText = (text: string) => {
    if (!text) return;
    webRef.current?.injectJavaScript(`window.__pimonInsertText && window.__pimonInsertText(${JSON.stringify(text)}); true;`);
  };
  // Forward a non-printable key (Backspace, Enter, arrows, …) into the session.
  const forwardSpecial = (key: string) => {
    webRef.current?.injectJavaScript(`window.__pimonSendKey && window.__pimonSendKey(${JSON.stringify(key)}); true;`);
  };
  const onKbChange = (text: string) => {
    const prev = kbLast.current;
    kbLast.current = text;
    if (text.length > prev.length) forwardText(text.slice(prev.length));
    else if (text.length < prev.length) {
      const removed = prev.length - text.length;
      for (let i = 0; i < removed; i++) forwardSpecial('Backspace');
    }
  };
  const onKbKeyPress = (e: any) => {
    const key = e.nativeEvent?.key;
    if (key === 'Backspace') return; // handled by onKbChange
    if (key === 'Enter' || key === 'return') forwardSpecial('Enter');
    else if (key === 'Tab') forwardSpecial('Tab');
    else if (key === 'Escape') forwardSpecial('Escape');
    else if (key === 'ArrowLeft') forwardSpecial('ArrowLeft');
    else if (key === 'ArrowRight') forwardSpecial('ArrowRight');
    else if (key === 'ArrowUp') forwardSpecial('ArrowUp');
    else if (key === 'ArrowDown') forwardSpecial('ArrowDown');
  };

  const signOut = () => {
    webRef.current?.injectJavaScript(`window.location.href=${JSON.stringify(CONNECT_URLS.signOut)}; true;`);
    // Give Connect a moment to end the session server-side, then leave this
    // screen and sign out locally (state first, then a full cookie/data wipe).
    setTimeout(() => {
      if (nav.canGoBack()) nav.goBack();
      signOutOfConnect();
    }, 700);
  };

  const menu = () => {
    const options = ['Reload', 'Open in Safari', 'Sign out', 'Cancel'];
    const run = (i: number) => {
      if (i === 0) webRef.current?.reload();
      else if (i === 1) Linking.openURL(CONNECT_URLS.devices).catch(() => {});
      else if (i === 2) signOut();
    };
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options, cancelButtonIndex: 3, destructiveButtonIndex: 2, userInterfaceStyle: 'dark' },
        run,
      );
    } else {
      run(0);
    }
  };

  const iconBtn = (name: keyof typeof Ionicons.glyphMap, onPress: () => void, label: string) => (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} hitSlop={8}
      style={({ pressed }) => ({
        width: 38, height: 38, borderRadius: 19,
        backgroundColor: pressed ? '#2A2A2E' : 'rgba(40,40,44,0.9)',
        alignItems: 'center', justifyContent: 'center',
      })}
    >
      <Ionicons name={name} size={19} color="#EDEDF0" />
    </Pressable>
  );

  // Live GUI / SSH session: no app header — the session fills the screen edge to
  // edge (inside the safe area), with small floating controls to leave or switch.
  if (inSession && !unlocked) return <View style={{ flex: 1, backgroundColor: '#000' }} />;

  if (inSession) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000', paddingTop: insets.top, paddingBottom: insets.bottom, paddingLeft: insets.left, paddingRight: insets.right }}>
        {!closing && <ConnectWebView
          ref={webRef}
          source={{ uri: startUrl }}
          onUrl={onUrl}
          onMessage={onMessage}
          probe={false}
          injectedJavaScript={SESSION_CHROME_JS}
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => {
            setLoading(false);
            // Reveal only when the injected script reports the screen is ready —
            // the waiting screen covers Connect's page until then (no white flash).
            if (revealTimer.current) clearTimeout(revealTimer.current);
            revealTimer.current = setTimeout(() => {
              setSessionError("The device didn't answer. It may be off, or its screen sharing may be disabled.");
            }, 45000);
          }}
          // In a live session a pull-down or an edge swipe must reach the Pi,
          // not reload the page or navigate back (which drops the connection).
          pullToRefreshEnabled={false}
          allowsBackForwardNavigationGestures={false}
          bounces={false}
          style={{ flex: 1, backgroundColor: '#000' }}
        />}
        {!closing && <ConnectingOverlay
          visible={connecting}
          title="Connecting…"
          subtitle={`${params.mode === 'ssh' ? 'Opening terminal on' : 'Opening desktop of'} ${params.title ?? 'your Pi'}`}
          error={sessionError}
          onCancel={closeSession}
          onRetry={retrySession}
        />}
        {!connecting && !closing && (
          <EdgeDock
            icon={params.mode === 'ssh' ? 'terminal' : 'desktop'}
            bottomInset={kbHeight > 0 ? kbHeight - insets.bottom : 0}
            actions={[
              // One button that follows the keyboard: open it, or hide it while it's up.
              kbHeight > 0
                ? { icon: 'chevron-down-circle', label: 'Hide keyboard', onPress: hideKeyboard }
                : { icon: 'keypad', label: 'Keyboard', onPress: openKeyboard },
              { icon: 'close', label: 'Close session', onPress: closeSession, tint: '#FF8A8A' },
            ]}
          />
        )}
        {/* Hidden native field that hosts the keyboard; keys are forwarded to the
            WebView so they reach the Pi. */}
        <TextInput
          ref={kbRef}
          onChangeText={onKbChange}
          onKeyPress={onKbKeyPress}
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          autoComplete="off"
          keyboardAppearance="dark"
          style={{ position: 'absolute', left: 8, bottom: 8, width: 2, height: 2, opacity: 0.02, padding: 0, margin: 0, color: 'transparent', backgroundColor: 'transparent' }}
        />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.surface.canvas }}>
      <View
        style={{
          paddingTop: insets.top + 6, paddingHorizontal: 14, paddingBottom: 10,
          flexDirection: 'row', alignItems: 'center', gap: 10,
        }}
      >
        {iconBtn(canGoBack ? 'chevron-back' : 'close', () => (canGoBack ? webRef.current?.goBack() : nav.goBack()), 'Back')}
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={{ ...type.title3, color: c.text.primary }}>
            {device.name || params.title || (device.id ? 'Device' : 'My devices')}
          </Text>
          {!!email && (
            <Text numberOfLines={1} style={{ ...type.caption, color: c.text.secondary }}>{email}</Text>
          )}
        </View>
        {!!device.id && iconBtn('terminal-outline', openSsh, 'Open SSH terminal')}
        {iconBtn('ellipsis-horizontal', menu, 'More')}
      </View>

      <View style={{ flex: 1 }}>
        <ConnectWebView
          ref={webRef}
          source={{ uri: startUrl }}
          onUrl={onUrl}
          onMessage={onMessage}
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => setLoading(false)}
          onNavigationStateChange={(s) => setCanGoBack(s.canGoBack)}
          style={{ flex: 1, backgroundColor: c.surface.canvas }}
        />
        {loading && (
          <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color={c.accent.base} />
          </View>
        )}
      </View>
    </View>
  );
}
