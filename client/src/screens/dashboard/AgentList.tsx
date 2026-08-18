// Agent list (§5.1): inventory and comparative health. Tapping a card makes it
// current (tearing down the previous Tunnel and re-entering loading honestly,
// §1.3); long-press opens Agent detail.
import React from 'react';
import { View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useStore } from '../../store/useStore';
import { Screen } from '../../components/Shared';
import { AgentCard } from '../../components/AgentCard';
import { EmptyState } from '../../components/States';
import { ActionButton } from '../../components/ActionButton';
import { connectAgent, disconnectAgent } from '../../net/transport';

export function AgentList() {
  const nav = useNavigation<any>();
  const agents = useStore((s) => s.agents);
  const currentId = useStore((s) => s.currentAgentId);
  const connection = useStore((s) => s.connection);
  const snapshot = useStore((s) => s.snapshot);
  const setStore = useStore((s) => s.set);

  if (agents.length === 0) {
    return (
      <Screen>
        <EmptyState
          title="No Pis yet"
          body="Pair a Raspberry Pi to see it here. It takes about two minutes."
          actionLabel="Pair a Pi"
          onAction={() => nav.navigate('AddRealPi', {})}
        />
      </Screen>
    );
  }

  const switchTo = (agentId: string) => {
    if (agentId !== currentId) {
      disconnectAgent();
      setStore({ currentAgentId: agentId, snapshot: null, connection: { kind: 'unknown' } });
      connectAgent(agentId);
    }
    nav.goBack();
  };

  return (
    <Screen>
      <View style={{ gap: 12 }}>
        {agents.map((agent) => (
          <AgentCard
            key={agent.id}
            agent={agent}
            connection={agent.id === currentId ? connection : { kind: 'unknown' }}
            snapshot={agent.id === currentId ? snapshot : null}
            selected={agent.id === currentId}
            onPress={() => switchTo(agent.id)}
            onLongPress={() => nav.navigate('AgentDetail', { agentId: agent.id })}
          />
        ))}
      </View>
      <ActionButton
        label="Pair another Pi"
        variant="secondary"
        onPress={() => nav.navigate('AddRealPi', {})}
        style={{ marginTop: 24 }}
      />
      <ActionButton
        label="About this Pi"
        variant="tertiary"
        onPress={() => nav.navigate('AgentDetail', { agentId: currentId })}
        style={{ marginTop: 4 }}
      />
    </Screen>
  );
}
