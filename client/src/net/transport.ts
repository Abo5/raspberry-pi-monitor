// One place that decides how an Agent is reached. Every paired Pi has a saved
// endpoint and uses the real Agent API; there is no simulated transport.
import { useStore } from '../store/useStore';
import { connectLocal, disconnectLocal } from './localTransport';

export function isReal(agentId: string | null | undefined): boolean {
  if (!agentId) return false;
  return !!useStore.getState().endpoints[agentId];
}

export function connectAgent(agentId: string | null): void {
  const ep = agentId ? useStore.getState().endpoints[agentId] : undefined;
  if (ep) {
    connectLocal(ep);
  } else {
    // No endpoint for this agent — say so honestly instead of pretending.
    useStore.getState().set({ connection: { kind: 'offline', lastSeen: Date.now() } });
    useStore.getState().addEvent('WARN', 'no saved endpoint for this Pi — re-pair it');
  }
}

export function disconnectAgent(): void {
  disconnectLocal();
}
