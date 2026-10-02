// Face ID / Touch ID checks. A prompt is only possible when the iPhone has the
// hardware AND the user has enrolled a face/finger — on a phone without it (or
// the simulator) authenticateAsync just fails, which used to lock the user out
// of the Face ID switch and of every gate behind it.
import { useEffect, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import * as LocalAuthentication from 'expo-local-authentication';
import { useStore } from '../store/useStore';

export async function biometricAvailable(): Promise<boolean> {
  try {
    return (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync());
  } catch {
    return false;
  }
}

/** Ask for Face ID before a sensitive step. With no Face ID set up there is
 *  nothing to ask, so the step goes ahead. */
export async function confirmWithBiometrics(promptMessage: string): Promise<boolean> {
  if (!(await biometricAvailable())) return true;
  const res = await LocalAuthentication.authenticateAsync({ promptMessage });
  return res.success;
}

/**
 * Gate a screen behind Face ID when the user turned it on (Settings › Security):
 * returns false until it passes; a failed or cancelled check leaves the screen.
 * Every shell / desktop screen calls this itself, so each way in — a device
 * card, a widget link, the Control tab — is covered exactly once.
 */
export function useBiometricGate(active: boolean, promptMessage: string): boolean {
  const nav = useNavigation<any>();
  const [unlocked, setUnlocked] = useState(() => !active || !useStore.getState().settings.requireBioShellDesktop);
  useEffect(() => {
    if (unlocked) return;
    let alive = true;
    confirmWithBiometrics(promptMessage).then((ok) => {
      if (!alive) return;
      if (ok) setUnlocked(true);
      else if (nav.canGoBack()) nav.goBack();
    });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return unlocked;
}
