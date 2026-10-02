// JS side of the local ConnectCookies native module (modules/connect-cookies/ios).
import { requireOptionalNativeModule } from 'expo-modules-core';

export type StoredCookie = {
  name: string;
  value: string;
  domain: string;
  path: string;
  secure: boolean;
  httpOnly: boolean;
};

type Native = {
  getAll(domain: string): Promise<StoredCookie[]>;
  set(cookie: StoredCookie, expiresMs: number): Promise<boolean>;
  clear(domain: string): Promise<number>;
};

// Optional: absent in Jest / Expo Go, where callers fall back to "no saved session".
const native = requireOptionalNativeModule<Native>('ConnectCookies');

export const ConnectCookies = {
  available: !!native,
  getAll: (domain: string) => native?.getAll(domain) ?? Promise.resolve([]),
  set: (cookie: StoredCookie, expiresMs: number) => native?.set(cookie, expiresMs) ?? Promise.resolve(false),
  clear: (domain: string) => native?.clear(domain) ?? Promise.resolve(0),
};
