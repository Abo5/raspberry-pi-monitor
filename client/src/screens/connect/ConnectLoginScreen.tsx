// Raspberry Pi Connect sign-in, shown as a regular stack screen that slides up
// from the bottom. Deliberately NOT a native modal: both a React Native <Modal>
// and a native-stack `presentation: 'modal'` sheet came up unable to receive any
// touch in this RN 0.86 / react-native-screens setup (UIKit's hit-test stopped at
// the sheet container and never reached the screen), so nothing inside — not
// even "Done" — responded. A plain card screen receives touches normally.
//
// Login only: the user signs in on Raspberry Pi's own page (Turnstile/OAuth run
// there). As soon as Connect lands on a signed-in page we mark the session live,
// ask the background check to re-read the devices, and close this screen.
import React, { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import { useTheme } from '../../theme';
import { useStore } from '../../store/useStore';
import { ConnectWebView } from '../../components/ConnectWebView';
import { CONNECT_URLS, ConnectProbe, classifyUrl, connectSignOutReason } from '../../net/connect';

export function ConnectLoginScreen() {
  const { c, type } = useTheme();
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const setConnectAuth = useStore((s) => s.setConnectAuth);
  const set = useStore((s) => s.set);

  const webRef = useRef<WebView>(null);
  const [loading, setLoading] = useState(true);
  const [host, setHost] = useState('connect.raspberrypi.com');
  const emailRef = useRef<string | null>(null);
  const doneRef = useRef(false);

  const close = () => {
    if (nav.canGoBack()) nav.goBack();
  };

  const onUrl = (url: string) => {
    try { setHost(new URL(url).host); } catch {}
    if (doneRef.current) return;
    if (classifyUrl(url) === 'signedIn') {
      doneRef.current = true;
      connectSignOutReason.manual = false;
      // Signing in from onboarding swaps the whole navigator for the home tabs,
      // which removes this screen by itself. Popping it as well runs a back
      // animation inside a tree that is being torn down — that's what left the
      // layout broken after a quick sign-in/out. Only pop when the tabs stay.
      const leavesWithTree = !useStore.getState().paired;
      setConnectAuth(true, emailRef.current);
      // Re-read the devices (and save the session) via the background check.
      set({ connectStatus: 'signedIn', connectCheckNonce: useStore.getState().connectCheckNonce + 1 });
      if (!leavesWithTree) close();
    }
  };

  const onMessage = (e: any) => {
    try {
      const msg = JSON.parse(e.nativeEvent.data) as ConnectProbe;
      if (msg?.type !== 'connect') return;
      if (msg.email) emailRef.current = msg.email;
      // Reported after every load and in-page (Turbo) navigation.
      if (msg.href) onUrl(msg.href);
    } catch {}
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.surface.canvas }}>
      {/* Safari-style bar: reload · 🔒 site · Done */}
      <View
        style={{
          paddingTop: insets.top + 8, paddingHorizontal: 14, paddingBottom: 10,
          flexDirection: 'row', alignItems: 'center',
          backgroundColor: c.surface.raised,
          borderBottomWidth: 1, borderBottomColor: c.border.hairline,
        }}
      >
        <Pressable onPress={() => webRef.current?.reload()} hitSlop={10} accessibilityLabel="Reload" style={{ width: 60 }}>
          <Ionicons name="refresh" size={21} color={c.accent.base} />
        </Pressable>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
          <Ionicons name="lock-closed" size={12} color={c.text.tertiary} />
          <Text numberOfLines={1} style={{ ...type.subhead, color: c.text.primary }}>{host}</Text>
        </View>
        <Pressable
          onPress={close}
          hitSlop={10} accessibilityRole="button" accessibilityLabel="Done" style={{ width: 60, alignItems: 'flex-end' }}>
          <Text style={{ ...type.bodyEmph, color: c.accent.base }}>تم</Text>
        </Pressable>
      </View>

      <View style={{ flex: 1 }}>
        <ConnectWebView
          ref={webRef}
          source={{ uri: CONNECT_URLS.devices }}
          onUrl={onUrl}
          onMessage={onMessage}
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => setLoading(false)}
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
