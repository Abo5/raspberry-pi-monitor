// JS side of the local PiSsh native module (modules/pi-ssh/ios).
import { requireOptionalNativeModule } from 'expo-modules-core';

type Native = {
  connect(host: string, port: number, username: string, password: string, expectedHostKey: string | null): Promise<{ id: string; hostKey: string }>;
  exec(id: string, command: string): Promise<string>;
  disconnect(id: string): Promise<void>;
};

// Optional: absent in Jest / Expo Go.
const native = requireOptionalNativeModule<Native>('PiSsh');

export const PiSsh = {
  available: !!native,
  connect: (host: string, port: number, username: string, password: string, expectedHostKey: string | null) => {
    if (!native) return Promise.reject(new Error('SSH is not available in this build'));
    return native.connect(host, port, username, password, expectedHostKey);
  },
  exec: (id: string, command: string) => native?.exec(id, command) ?? Promise.reject(new Error('SSH unavailable')),
  disconnect: (id: string) => native?.disconnect(id) ?? Promise.resolve(),
};
