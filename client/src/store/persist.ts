// Client-side cache persistence. Per README P4 the Pi is the source of truth —
// what we persist here is the pairing/trust records, settings, and the local
// cache (rules, alerts, action metadata) that the real Client would also hold.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useStore } from './useStore';

const KEY = 'pimon-state-v1';

const FIELDS = [
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
      useStore.getState().set(partial as never);
    }
  } catch {
    // err.cache: clearing is safe — the real history lives on the Pi.
  }
  useStore.getState().set({ hydrated: true });
}

let timer: ReturnType<typeof setTimeout> | null = null;

export function startPersistence(): void {
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
