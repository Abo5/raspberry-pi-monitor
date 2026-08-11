// One hook for chart history: real samples from the Agent's /series. No
// endpoint (shouldn't happen for a paired Pi) → an honest empty chart.
import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../store/useStore';
import { Sample, SeriesKey } from '../types';
import { fetchSeries } from './localTransport';

export function useSeriesHistory(key: SeriesKey, rangeMs: number, tick?: number): Sample[] {
  const agentId = useStore((s) => s.currentAgentId);
  const endpoint = useStore((s) => (agentId ? s.endpoints[agentId] : undefined));
  const [real, setReal] = useState<Sample[] | null>(null);

  useEffect(() => {
    let alive = true;
    if (endpoint) {
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
  }, [endpoint?.ip, endpoint?.port, key, rangeMs, tick]);

  return useMemo(() => (endpoint ? real ?? [] : []), [endpoint, real, key, rangeMs, tick]);
}
