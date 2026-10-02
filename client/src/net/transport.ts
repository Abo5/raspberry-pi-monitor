// One place that decides how an Agent is reached. Every paired Pi has a saved
// endpoint and uses the real Agent API; there is no simulated transport.
import { useStore } from '../store/useStore';
import { connectLocal, disconnectLocal } from './localTransport';
import { startSshMonitor, stopSshMonitor } from './sshMonitor';

export function isReal(agentId: string | null | undefined): boolean {
  if (!agentId) return false;
  return !!useStore.getState().endpoints[agentId];
}

export function connectAgent(agentId: string | null): void {
  // Monitoring over SSH takes precedence: no agent needed on the Pi.
  if (useStore.getState().sshMonitor) {
    startSshMonitor();
    return;
  }
  const ep = agentId ? useStore.getState().endpoints[agentId] : undefined;
  if (ep) {
    connectLocal(ep);
  } else if (useStore.getState().connectStatus !== 'signedOut') {
    // No agent, but Raspberry Pi Connect is (or may be) signed in: the Monitor
    // runs through Connect's remote shell (components/ConnectMonitor) instead.
  } else {
    // No endpoint for this agent — say so honestly instead of pretending.
    useStore.getState().set({ connection: { kind: 'offline', lastSeen: Date.now() } });
    useStore.getState().addEvent('WARN', 'no saved endpoint for this Pi — re-pair it');
  }
}

export function disconnectAgent(): void {
  stopSshMonitor();
  disconnectLocal();
}
