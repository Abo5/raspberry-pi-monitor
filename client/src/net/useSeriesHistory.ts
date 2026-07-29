// One hook for chart history that is honest about its source: real samples from
// the Agent's /series when the current Pi has an endpoint, simulated samples for
// the demo Pi. Screens don't need to know which.
import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../store/useStore';
import { Sample, SeriesKey } from '../types';
import { sampleSeries } from '../sim/metrics';
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

  return useMemo(() => {
    if (endpoint) return real ?? [];
    const to = Date.now();
    return sampleSeries(key, to - rangeMs, to, 120);
  }, [endpoint, real, key, rangeMs, tick]);
}
