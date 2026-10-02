// One hook for chart history: real samples from the Agent's /series. No
// endpoint (shouldn't happen for a paired Pi) → an honest empty chart.
import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../store/useStore';
import { Sample, SeriesKey } from '../types';
import { fetchSeries } from './localTransport';
import { sshSeries } from './sshMonitor';

export function useSeriesHistory(key: SeriesKey, rangeMs: number, tick?: number): Sample[] {
  const agentId = useStore((s) => s.currentAgentId);
  const endpoint = useStore((s) => (agentId ? s.endpoints[agentId] : undefined));
  // SSH and Connect's remote shell both keep their history in memory here.
  const viaSsh = useStore((s) => !!s.sshMonitor || !!s.connectMonitorName);
  const [real, setReal] = useState<Sample[] | null>(null);

  useEffect(() => {
    let alive = true;
    if (endpoint && !viaSsh) {
      const to = Date.now();
      fetchSeries(endpoint, key, to - rangeMs, to).then((s) => {
        if (alive) setReal(s);
      });
    } else {
      setReal(null);
    }
    return () => {
      alive = false;
    };
  }, [viaSsh, endpoint?.ip, endpoint?.port, key, rangeMs, tick]);

  return useMemo(() => {
    if (viaSsh) {
      const to = Date.now();
      return sshSeries(key, to - rangeMs, to);
    }
    return endpoint ? real ?? [] : [];
  }, [viaSsh, endpoint, real, key, rangeMs, tick]);
}
