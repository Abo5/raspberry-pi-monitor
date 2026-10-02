// Invisible background check of the Raspberry Pi Connect session, mounted once at
// the app root. It loads connect.raspberrypi.com/devices in a hidden WebView that
// shares the app's cookie store. If that page opens (session still valid) we
// read the account's devices and the app goes straight to its home screen. If
// Connect redirects to sign-in instead, we only report "signed out" — the app then
// shows the login pop-up and the user signs in themselves.
import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { WebView } from 'react-native-webview';
import { ConnectWebView } from './ConnectWebView';
import { useStore } from '../store/useStore';
import { CONNECT_URLS, classifyUrl, connectSignOutReason } from '../net/connect';
import { clearConnectCookies, restoreConnectCookies, saveConnectCookies } from '../net/connectCookies';

// Reads the device cards on /devices: every link to a single device page, its
// visible name, and whether its status dot is green (online).
const READ_DEVICES_JS = `
(function () {
  var RN = window.ReactNativeWebView; if (!RN) return;
  if (location.pathname.indexOf('/devices') !== 0) return;
  function read() {
    var seen = {}, out = [];
    document.querySelectorAll('a[href*="/devices/"]').forEach(function (a) {
      var m = a.getAttribute('href').match(/\\/devices\\/([A-Za-z0-9_-]{6,})/);
      if (!m || seen[m[1]]) return;
      var name = (a.textContent || '').replace(/\\s+/g, ' ').trim();
      if (!name) return;
      seen[m[1]] = true;
      // The device's card: climb while the ancestor still holds only this device.
      var card = a;
      while (card.parentElement && !/^(BODY|MAIN|HTML|UL|OL)$/.test(card.parentElement.tagName)) {
        var ids = {};
        card.parentElement.querySelectorAll('a[href*="/devices/"]').forEach(function (x) {
          var mm = x.getAttribute('href').match(/\\/devices\\/([A-Za-z0-9_-]{6,})/);
          if (mm) ids[mm[1]] = 1;
        });
        if (Object.keys(ids).length > 1) break;
        card = card.parentElement;
      }
      var text = (card.innerText || card.textContent || '').toLowerCase();
      var online;
      if (/\\boffline\\b|not connected|unavailable/.test(text)) online = false;
      else if (/\\bonline\\b|\\bconnected\\b|available/.test(text)) online = true;
      else online = /bg-green|text-green|online|success/i.test(card.innerHTML);
      out.push({ id: m[1], name: name.slice(0, 60), online: online, url: new URL(a.getAttribute('href'), location.href).href });
    });
    RN.postMessage(JSON.stringify({ type: 'devices', devices: out }));
  }
  // The page fills in statuses after load — read a few times.
  [800, 2500, 6000].forEach(function (t) { setTimeout(read, t); });
})();
true;
`;

export function ConnectSession() {
  const nonce = useStore((s) => s.connectCheckNonce);
  const status = useStore((s) => s.connectStatus);
  const sessionActive = useStore((s) => s.connectSessionActive);
  const set = useStore((s) => s.set);
  const setConnectAuth = useStore((s) => s.setConnectAuth);
  const webRef = useRef<WebView>(null);
  // Put the saved session back into the cookie store before the first check.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    restoreConnectCookies().finally(() => {
      setReady(true);
      useStore.getState().set({ connectCookiesReady: true });
    });
  }, []);
  const decided = useRef<string | null>(null);
  // Every new check (after a sign-in, or a sign-out → sign-in) decides afresh.
  useEffect(() => {
    if (status === 'signedOut') decided.current = null;
  }, [status, nonce]);

  const onUrl = (url: string) => {
    const state = classifyUrl(url);
    if (state === 'signedOut') {
      if (decided.current === 'signedOut') return;
      decided.current = 'signedOut';
      // Saved session rejected → wipe the stale cookies first, then ask the user
      // to sign in (so the login pop-up starts from a clean cookie state).
      setConnectAuth(false, null);
      clearConnectCookies().finally(() => set({ connectStatus: 'signedOut' }));
    } else if (state === 'signedIn') {
      // A page still finishing after the user signed out must not sign them back in.
      if (useStore.getState().connectStatus === 'signedOut') return;
      decided.current = 'signedIn';
      setConnectAuth(true, undefined);
      set({ connectStatus: 'signedIn' });
      // Keep a fresh copy so the next launch opens straight to the devices.
      saveConnectCookies();
    }
  };

  const onMessage = (e: any) => {
    try {
      const msg = JSON.parse(e.nativeEvent.data);
      if (msg?.type === 'devices' && Array.isArray(msg.devices)) set({ connectDevices: msg.devices });
      if (msg?.type === 'connect' && msg.href) onUrl(msg.href);
    } catch {}
  };

  // Once we know the user must sign in, get out of the way: this WebView shares
  // the cookie store with the login pop-up, and reloading Connect's sign-in page
  // here would replace the session/CSRF cookie the pop-up's form depends on — the
  // site then rejects "Sign in" and bounces back to /sign-in. We come back (via
  // connectCheckNonce) after the pop-up succeeds, to read the devices.
  // Stay out of the way while a live session runs: a second page on the same
  // account in the background can make the Pi drop the screen-sharing link.
  if (status === 'signedOut' || !ready || sessionActive) return null;

  return (
    <View pointerEvents="none" style={{ position: 'absolute', width: 1, height: 1, opacity: 0, left: -10, top: -10 }}>
      <ConnectWebView
        key={nonce}
        ref={webRef}
        source={{ uri: CONNECT_URLS.devices }}
        injectedJavaScript={READ_DEVICES_JS}
        onUrl={onUrl}
        onMessage={onMessage}
        // A network error is not an expired session: keep a signed-in state as is
        // (the next check retries), and only settle a first check quietly.
        onError={() => {
          if (useStore.getState().connectStatus !== 'checking') return;
          // Offline after a previous sign-in: keep the saved devices showing.
          if (useStore.getState().connectSignedIn) return;
          connectSignOutReason.quiet = true;
          set({ connectStatus: 'signedOut' });
        }}
      />
    </View>
  );
}
