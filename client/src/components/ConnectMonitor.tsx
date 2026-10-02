// Live Monitor through Raspberry Pi Connect — starts by itself after sign-in, no
// password and no setup. A hidden WebView opens the chosen Pi's remote shell
// (the same page Connect's "Remote shell" button opens) and every few seconds
// types the read-only METRICS_COMMAND into it; the output feeds the same
// snapshot/history the SSH monitor uses, so every Monitor screen just works.
//
// Used only when nothing better is set up (an SSH login or a paired agent take
// precedence). Pauses while a desktop/shell session is on screen — a second
// session to the same Pi can make Connect drop the visible one — and while the
// app is in the background.
import React, { useEffect, useRef, useState } from 'react';
import { AppState, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { ConnectWebView } from './ConnectWebView';
import { connectLive, useStore } from '../store/useStore';
import { CONNECT_SHELL_JS, DEVICE_SSH_SUFFIX } from '../net/connect';
import { attachShell, connectExec, detachShell, onShellResult } from '../net/connectShell';
import { applyReading, clearHistory, setExecFallback } from '../net/sshMonitor';
import { METRICS_COMMAND } from '../net/sshMetrics';

const POLL_MS = 3000;
const OPEN_TIMEOUT_MS = 45000; // Connect gives up on a session after ~40 s

export function ConnectMonitor() {
  // Start as soon as the saved session is back in the cookie store — no need to
  // wait for the background check to finish.
  const signedIn = useStore((s) => connectLive(s) && s.connectCookiesReady);
  const ssh = useStore((s) => !!s.sshMonitor);
  const hasAgent = useStore((s) => !!(s.currentAgentId && s.endpoints[s.currentAgentId]));
  const sessionActive = useStore((s) => s.connectSessionActive);
  const device = useStore((s) => {
    const list = s.connectDevices;
    return list.find((d) => d.id === s.monitorDeviceId) ?? list.find((d) => d.online) ?? list[0] ?? null;
  });
  const set = useStore((s) => s.set);

  const [appActive, setAppActive] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => setAppActive(st === 'active'));
    return () => sub.remove();
  }, []);

  const enabled = signedIn && !ssh && !hasAgent && !!device;
  const running = enabled && !sessionActive && appActive;

  // Name the source while it's in use; a different Pi starts a fresh history.
  const deviceId = device?.id ?? null;
  useEffect(() => {
    if (!enabled || !device) {
      set({ connectMonitorName: null });
      return;
    }
    set({ connectMonitorName: device.name });
  }, [enabled, device?.name]);
  // Only a switch to a *different* Pi starts over (not the first mount, which
  // would throw away the history saved from last time).
  const lastDevice = useRef(deviceId);
  useEffect(() => {
    if (lastDevice.current && deviceId && lastDevice.current !== deviceId) clearHistory();
    if (deviceId) lastDevice.current = deviceId;
  }, [deviceId]);

  // Each mount of the WebView is one shell session; bump to start a new one.
  const [attempt, setAttempt] = useState(0);
  const webRef = useRef<WebView>(null);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const failures = useRef(0);
  const live = useRef(false);
  const gotReading = useRef(false);

  const stopPolling = () => {
    live.current = false;
    if (pollTimer.current) clearTimeout(pollTimer.current);
    if (openTimer.current) clearTimeout(openTimer.current);
    pollTimer.current = null;
    openTimer.current = null;
    detachShell();
    setExecFallback(null);
  };

  // Start over with a fresh session after a short pause.
  const restart = (delayMs: number) => {
    stopPolling();
    set({ connection: { kind: 'reconnecting', attempt: failures.current + 1, nextTryInS: Math.round(delayMs / 1000) } });
    pollTimer.current = setTimeout(() => setAttempt((a) => a + 1), delayMs);
  };

  const poll = async () => {
    pollTimer.current = null;
    if (!live.current) return;
    const started = Date.now();
    try {
      const out = await connectExec(METRICS_COMMAND);
      if (!live.current) return;
      const first = !gotReading.current;
      gotReading.current = true;
      applyReading(out, started, 'relayed');
      failures.current = 0;
      // CPU % and network speed need two readings — take the 2nd one quickly.
      pollTimer.current = setTimeout(poll, first ? 800 : POLL_MS);
    } catch {
      if (!live.current) return;
      failures.current += 1;
      // One slow answer can happen; two in a row → the session is gone.
      if (failures.current >= 2) restart(Math.min(30000, 3000 * failures.current));
      else pollTimer.current = setTimeout(poll, POLL_MS);
    }
  };

  const onShellOpen = () => {
    if (openTimer.current) clearTimeout(openTimer.current);
    openTimer.current = null;
    attachShell((text) => {
      webRef.current?.injectJavaScript(`window.__pimonShellSend && window.__pimonShellSend(${JSON.stringify(text)}); true;`);
    });
    set({ connection: { kind: 'connecting', milestone: 3 } });
    // Type right away: the terminal buffers input until the shell is ready, and
    // the output markers make any echo/prompt noise harmless.
    // Keep our commands out of the user's shell history.
    webRef.current?.injectJavaScript(`window.__pimonShellSend && window.__pimonShellSend(${JSON.stringify(' unset HISTFILE 2>/dev/null\r')}); true;`);
    setExecFallback((command) => connectExec(command));
    poll();
  };

  const onMessage = (e: any) => {
    try {
      const msg = JSON.parse(e.nativeEvent.data);
      if (msg?.type === 'shell-result') onShellResult(msg.id, String(msg.out ?? ''));
      else if (msg?.type === 'shell-open') onShellOpen();
      else if (msg?.type === 'shell-closed' || msg?.type === 'shell-error') {
        if (live.current) {
          failures.current += 1;
          restart(Math.min(30000, 3000 * failures.current));
        }
      }
    } catch {}
  };

  // Session lifecycle: (re)start when running, stop otherwise.
  useEffect(() => {
    if (!running) {
      stopPolling();
      return;
    }
    live.current = true;
    gotReading.current = false;
    set({ connection: { kind: 'connecting', milestone: 0 } });
    openTimer.current = setTimeout(() => {
      failures.current += 1;
      restart(Math.min(30000, 3000 * failures.current));
    }, OPEN_TIMEOUT_MS);
    return stopPolling;
  }, [running, deviceId, attempt]);

  if (!running || !device) return null;

  const url = `${device.url.replace(/\/$/, '')}${DEVICE_SSH_SUFFIX}`;
  return (
    // Off-screen but terminal-sized: the page tells the Pi its window size, and a
    // 1-px terminal would make commands like `ps` cut their output to 1 column.
    <View pointerEvents="none" style={{ position: 'absolute', width: 1024, height: 640, opacity: 0, left: -10000, top: 0 }}>
      <ConnectWebView
        key={`${deviceId}:${attempt}`}
        ref={webRef}
        source={{ uri: url }}
        probe={false}
        injectedJavaScriptBeforeContentLoaded={CONNECT_SHELL_JS}
        onMessage={onMessage}
        onError={() => restart(5000)}
      />
    </View>
  );
}
