// Alerts list (§13.1): Active / History segments, severity-then-recency sort.
// The good empty state reads like good news.
import React, { useEffect, useLayoutEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { useTheme, withAlpha } from '../../theme';
import { useStore } from '../../store/useStore';
import { Screen } from '../../components/Shared';
import { AlertRow } from '../../components/AlertRow';
import { EmptyState } from '../../components/States';
import { fetchAlerts } from '../../net/localTransport';
import { Alert } from '../../types';

const SEV_ORDER = { critical: 0, warning: 1, info: 2 };

export function AlertsList() {
  const { c, type, radius } = useTheme();
  const nav = useNavigation<any>();
  const isFocused = useIsFocused();
  const agentId = useStore((s) => s.currentAgentId);
  const agent = useStore((s) => s.agents.find((a) => a.id === agentId));
  const endpoint = useStore((s) => (agentId ? s.endpoints[agentId] : undefined));
  const storeAlerts = useStore((s) => s.alerts);
  const [segment, setSegment] = useState<'active' | 'history'>('active');

  // Real Agent: pull authoritative alert history from the Pi; else the demo store.
  const [realAlerts, setRealAlerts] = useState<Alert[]>([]);
  useEffect(() => {
    if (endpoint && isFocused) {
      fetchAlerts(endpoint).then((rows) =>
        setRealAlerts(
          rows.map((r: any) => ({
            id: r.id,
            ruleId: r.ruleId,
            agentId: agentId ?? '',
            seriesKey: r.seriesKey,
            severity: r.severity,
            title: r.title,
            firedAt: r.firedAt,
            resolvedAt: r.resolvedAt ?? null,
            acknowledgedAt: null,
            snoozedUntil: null,
            peak: { v: r.peakV, t: r.peakT },
          })),
        ),
      );
    }
  }, [endpoint?.ip, isFocused]);

  const alerts = endpoint ? realAlerts : storeAlerts;

  // "Rules" is a standard trailing header button, not a control floating next
  // to the segmented pill.
  useLayoutEffect(() => {
    nav.setOptions({
      headerRight: () => (
        <Pressable onPress={() => nav.navigate('Rules')} accessibilityRole="button" hitSlop={8}>
          <Text style={[type.bodyEmph, { color: c.accent.base }]}>Rules</Text>
        </Pressable>
      ),
    });
  }, [nav, c.accent.base]);

  const active = alerts
    .filter((a) => a.resolvedAt == null)
    .sort((a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity] || b.firedAt - a.firedAt);
  const history = alerts.filter((a) => a.resolvedAt != null).sort((a, b) => b.firedAt - a.firedAt);
  const shown = segment === 'active' ? active : history;

  return (
    <Screen>
      <View
        style={{
          flexDirection: 'row',
          backgroundColor: c.surface.raised,
          borderRadius: radius.s,
          borderWidth: 1,
          borderColor: c.border.subtle,
          padding: 2,
          marginBottom: 16,
        }}
      >
        {(['active', 'history'] as const).map((seg) => (
          <Pressable
            key={seg}
            onPress={() => setSegment(seg)}
            accessibilityRole="button"
            accessibilityState={{ selected: segment === seg }}
            style={{
              flex: 1,
              height: 32,
              borderRadius: radius.s - 2,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: segment === seg ? withAlpha(c.accent.base, c.accent.washAlpha) : 'transparent',
            }}
          >
            <Text style={[type.subhead, { color: segment === seg ? c.accent.base : c.text.secondary, fontWeight: '600' }]}>
              {seg === 'active' ? `Active (${active.length})` : 'History'}
            </Text>
          </Pressable>
        ))}
      </View>

      {shown.length === 0 ? (
        segment === 'active' ? (
          <EmptyState
            icon="checkmark-circle-outline"
            title="Nothing is wrong"
            body={`No alert rules are firing on ${agent?.name ?? 'your Pi'} right now.`}
            actionLabel="See rules"
            onAction={() => nav.navigate('Rules')}
          />
        ) : (
          <EmptyState
            icon="time-outline"
            title="No alerts in the last 30 days"
            body="Either everything has been fine, or there are no rules yet."
            actionLabel="See rules"
            onAction={() => nav.navigate('Rules')}
          />
        )
      ) : (
        <View style={{ gap: 8 }}>
          {shown.map((a) => (
            <AlertRow
              key={a.id}
              alert={a}
              agentName={agent?.name ?? ''}
              onPress={() => nav.navigate('AlertDetail', { alertId: a.id })}
            />
          ))}
        </View>
      )}
    </Screen>
  );
}
