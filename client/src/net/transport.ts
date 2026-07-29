// One place that decides real vs simulated transport for an Agent.
// A paired Pi with a saved endpoint uses the real Agent API; the demo Pi and
// anything without an endpoint uses the in-app simulation.
import { useStore } from '../store/useStore';
import { startTunnel, stopTunnel } from '../sim/tunnel';
import { connectLocal, disconnectLocal } from './localTransport';

export function isReal(agentId: string | null | undefined): boolean {
  if (!agentId) return false;
  return !!useStore.getState().endpoints[agentId];
}

export function connectAgent(agentId: string | null): void {
  const ep = agentId ? useStore.getState().endpoints[agentId] : undefined;
  if (ep) connectLocal(ep);
  else startTunnel();
}

export function disconnectAgent(): void {
  disconnectLocal();
  stopTunnel();
}
