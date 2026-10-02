import { connectSignOutReason } from './connect';
// Keeps the user's Raspberry Pi Connect session across app launches.
//
// Connect stores its session in a browser *session cookie*, which iOS drops
// whenever the app is closed — so every launch looked signed-out. After a
// successful sign-in we save the account's connect.raspberrypi.com cookies in the
// iOS Keychain, and on the next launch put them back into the WebView cookie store
// (with an expiry, so WebKit keeps them) before checking the session:
//   • still valid  → Connect opens /devices directly, no sign-in.
//   • rejected     → we clear them and show a clean sign-in.
import * as SecureStore from 'expo-secure-store';
import { ConnectCookies, StoredCookie } from '../../modules/connect-cookies';
import { useStore } from '../store/useStore';
import { clearLiveCache } from './sshMonitor';

const KEY = 'pimon.connect.cookies.v1';
const DOMAIN = 'connect.raspberrypi.com';
/** How long a restored cookie is kept locally; Connect itself decides validity. */
const KEEP_DAYS = 30;

type Saved = { savedAt: number; cookies: StoredCookie[] };

/** Save the current connect.raspberrypi.com cookies (call after a confirmed sign-in). */
export async function saveConnectCookies(): Promise<void> {
  try {
    const cookies = await ConnectCookies.getAll(DOMAIN);
    // A sign-out that landed while we were reading must not be undone here.
    if (!cookies.length || useStore.getState().connectStatus !== 'signedIn') return;
    const data: Saved = { savedAt: Date.now(), cookies };
    await SecureStore.setItemAsync(KEY, JSON.stringify(data));
  } catch {
    // Not fatal: the user simply signs in again next launch.
  }
}

/** Put saved cookies back into the WebView store. Returns true if any were restored. */
export async function restoreConnectCookies(): Promise<boolean> {
  try {
    const raw = await SecureStore.getItemAsync(KEY);
    if (!raw) return false;
    const data = JSON.parse(raw) as Saved;
    if (Date.now() - data.savedAt > KEEP_DAYS * 86400_000) {
      await clearConnectCookies();
      return false;
    }
    const expires = Date.now() + KEEP_DAYS * 86400_000;
    for (const c of data.cookies) await ConnectCookies.set(c, expires);
    return data.cookies.length > 0;
  } catch {
    return false;
  }
}

/** Remove the saved session and any connect.raspberrypi.com cookies in the WebView
 *  store, so the next sign-in starts clean. The Raspberry Pi ID account cookie
 *  (id.raspberrypi.com) is left alone, so "Sign in as …" still offers the account. */
export async function clearConnectCookies(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(KEY);
  } catch {}
  try {
    await ConnectCookies.clear(DOMAIN);
  } catch {}
}

/** Forget only the session saved in the Keychain (fast; no WebKit involved). */
export async function forgetSavedSession(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(KEY);
  } catch {}
}

/** Forget everything Raspberry Pi left on this phone: the saved session in the
 *  Keychain plus every raspberrypi.com cookie and website data (Connect and the
 *  Raspberry Pi ID account), so the next sign-in starts from scratch. */
export async function forgetConnectSession(): Promise<void> {
  await forgetSavedSession();
  try {
    await ConnectCookies.clear('raspberrypi.com');
  } catch {}
}

/** Full sign-out of the linked Raspberry Pi account. The app state flips first,
 *  so every Connect WebView unmounts before the cookies go and none of them can
 *  report "signed in" again mid-way; then the session data is wiped. The
 *  welcome screen is told not to pop the sign-in page for this. */
export async function signOutOfConnect(): Promise<void> {
  connectSignOutReason.quiet = true;
  connectSignOutReason.manual = true;
  useStore.getState().signOutConnect();
  clearLiveCache();
  useStore.getState().set({ snapshot: null });
  await forgetConnectSession();
}
