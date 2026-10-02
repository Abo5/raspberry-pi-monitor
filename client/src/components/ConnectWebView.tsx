// Authenticated WebView onto Raspberry Pi Connect. Shared by the sign-in gate,
// the device list, and full-screen GUI/SSH sessions. Centralises every setting
// that makes the real site work: persistent shared cookies (so the session
// survives relaunch), inline media (WebRTC remote desktop), and keeping the
// sign-in / Connect hosts inside the app while sending stray external links to
// the system browser.
import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { Linking } from 'react-native';
import { WebView, WebViewProps } from 'react-native-webview';
import { PROBE_JS, isConnectHost } from '../net/connect';

export type ConnectWebViewProps = WebViewProps & {
  /** Called whenever the current URL changes (drives auth-state classification). */
  onUrl?: (url: string) => void;
  /** Inject the URL/account probe (off for live sessions: nothing extra runs in them). */
  probe?: boolean;
};

export const ConnectWebView = forwardRef<WebView, ConnectWebViewProps>(function ConnectWebView(
  { onUrl, onNavigationStateChange, injectedJavaScript, probe = true, ...rest },
  ref,
) {
  const inner = useRef<WebView>(null);
  useImperativeHandle(ref, () => inner.current as WebView);

  return (
    <WebView
      ref={inner}
      // A page asking for a new window (window.open / target=_blank). Without
      // this handler iOS hands the link to the system browser, which pulls the
      // user out of the app into Safari. Keep Raspberry Pi pages in this view.
      onOpenWindow={(e) => {
        const url = e.nativeEvent.targetUrl;
        if (!url) return;
        if (isConnectHost(url)) {
          inner.current?.injectJavaScript(`window.location.href=${JSON.stringify(url)}; true;`);
        } else if (/^https?:/.test(url)) {
          Linking.openURL(url).catch(() => {});
        }
      }}
      // Persist the session. incognito defaults to false → WKWebView uses its
      // default (on-disk) data store, so cookies + credentials outlive relaunches.
      sharedCookiesEnabled
      thirdPartyCookiesEnabled
      domStorageEnabled
      javaScriptEnabled
      // Identify as Mobile Safari (WKWebView's default user agent omits the
      // "Version/… Safari/…" tokens), so Connect treats us like Safari on iOS.
      applicationNameForUserAgent="Version/26.0 Mobile/15E148 Safari/604.1"
      // WebRTC remote desktop: play the incoming video inline without a tap.
      allowsInlineMediaPlayback
      mediaPlaybackRequiresUserAction={false}
      allowsFullscreenVideo
      // Screen-sharing sessions negotiate WebRTC; don't interrupt with a prompt.
      mediaCapturePermissionGrantType="grant"
      // Swipe-back through the OAuth redirect chain and Connect pages.
      allowsBackForwardNavigationGestures
      pullToRefreshEnabled
      // Keep OAuth redirects in the same view rather than spawning popups.
      setSupportMultipleWindows={false}
      injectedJavaScript={probe ? `${PROBE_JS}\n${injectedJavaScript ?? ''}` : injectedJavaScript}
      // Allow every scheme in the WebView. The default whitelist (http/https
      // only) hands anything else — e.g. Cloudflare Turnstile's `about:srcdoc`
      // iframe — to Linking.openURL, which breaks the challenge (login never
      // completes) and tries to open an outside app.
      originWhitelist={['*']}
      // No onShouldStartLoadWithRequest on purpose: on iOS it makes WebKit wait
      // for a round-trip to the JS thread before *every* navigation, so while JS
      // is busy a tap on "Sign in" just sits there. Navigations now proceed
      // natively; new-window requests are still routed by onOpenWindow below.
      onNavigationStateChange={(navState) => {
        // Classify only settled URLs. During the sign-in redirect chain
        // (…/devices → /sign-in → id.raspberrypi.com) navState fires with
        // loading=true for the optimistic target; acting on those would treat
        // the pre-redirect /devices as "signed in". Wait for the final page.
        if (!navState.loading) onUrl?.(navState.url);
        onNavigationStateChange?.(navState);
      }}
      {...rest}
    />
  );
});
