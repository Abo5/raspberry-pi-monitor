// Client-side cache persistence. Per README P4 the Pi is the source of truth —
// what we persist here is the pairing/trust records, settings, and the local
// cache (rules, alerts, action metadata) that the real Client would also hold.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useStore } from './useStore';
import { forgetSavedSession } from '../net/connectCookies';
import { forgetPassword, loadLiveCache, startLiveCacheSaver } from '../net/sshMonitor';

const KEY = 'pimon-state-v1';

const FIELDS = [
  'connectSignedIn',
  'connectEmail',
  'connectDevices',
  'paired',
  'agents',
  'currentAgentId',
  'devices',
  'rules',
  'alerts',
  'actions',
  'settings',
  'firstRunCardDismissed',
  'selectedWidgets',
  'credentials',
  'endpoints',
  'sshMonitor',
  'monitorDeviceId',
] as const;

export async function hydrate(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) {
      const data = JSON.parse(raw);
      const partial: Record<string, unknown> = {};
      FIELDS.forEach((f) => {
        if (f in data) partial[f] = data[f];
      });
      // Face ID used to start ON. Unless the user chose it themselves, start
      // older installs off too, like a new one.
      const st = partial.settings as { requireBioShellDesktop?: boolean; bioUserSet?: boolean } | undefined;
      if (st && !st.bioUserSet) partial.settings = { ...st, requireBioShellDesktop: false };
      useStore.getState().set(partial as never);
    } else {
      // Fresh install. iOS wipes the app's files and WebKit data on delete, but
      // NOT the Keychain — so drop the saved session/password a previous install
      // left there. Nothing else can hold a session yet, so skip the background
      // check and ask the user to sign in right away.
      await Promise.all([forgetSavedSession(), forgetPassword()]);
      // Mark the install as seen right away, so the next launch isn't treated as
      // fresh again (and doesn't wipe a session saved in the meantime).
      await AsyncStorage.setItem(KEY, '{}');
      useStore.getState().set({ connectStatus: 'signedOut' });
    }
  } catch {
    // err.cache: clearing is safe — the real history lives on the Pi.
  }
  // Last Monitor reading + charts, so Monitor isn't empty while it reconnects.
  await loadLiveCache();
  useStore.getState().set({ hydrated: true });
}

let timer: ReturnType<typeof setTimeout> | null = null;

export function startPersistence(): void {
  startLiveCacheSaver();
  useStore.subscribe(() => {
    const s = useStore.getState();
    if (!s.hydrated) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      const latest = useStore.getState();
      const snap: Record<string, unknown> = {};
      FIELDS.forEach((f) => (snap[f] = latest[f]));
      AsyncStorage.setItem(KEY, JSON.stringify(snap)).catch(() => {});
    }, 500);
  });
}
