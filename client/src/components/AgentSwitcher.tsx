// Agent switcher (§5.2): a medium-detent sheet from the AgentChip. Compact
// AgentCards, the current one selected, plus "See all Pis". Switching costs
// one tap from any screen.
import React from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { useTheme } from '../theme';
import { useStore } from '../store/useStore';
import { AgentCard } from './AgentCard';
import { startTunnel, stopTunnel } from '../sim/tunnel';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSeeAll: () => void;
}

export function AgentSwitcher({ visible, onClose, onSeeAll }: Props) {
  const { c, type, radius } = useTheme();
  const agents = useStore((s) => s.agents);
  const currentId = useStore((s) => s.currentAgentId);
  const connection = useStore((s) => s.connection);
  const snapshot = useStore((s) => s.snapshot);
  const setStore = useStore((s) => s.set);

  const switchTo = (agentId: string) => {
    if (agentId !== currentId) {
      stopTunnel();
      setStore({ currentAgentId: agentId, snapshot: null, connection: { kind: 'unknown' } });
      startTunnel();
    }
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: c.surface.scrim }} onPress={onClose} />
      <View
        style={{
          backgroundColor: c.surface.raised2,
          borderTopLeftRadius: radius.xl,
          borderTopRightRadius: radius.xl,
          padding: 16,
          paddingBottom: 40,
          maxHeight: '55%',
        }}
      >
        <View
          style={{
            width: 36,
            height: 4,
            borderRadius: 2,
            backgroundColor: c.border.strong,
            alignSelf: 'center',
            marginBottom: 14,
          }}
        />
        <View style={{ gap: 10 }}>
          {agents.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              connection={agent.id === currentId ? connection : { kind: 'unknown' }}
              snapshot={agent.id === currentId ? snapshot : null}
              selected={agent.id === currentId}
              onPress={() => switchTo(agent.id)}
            />
          ))}
        </View>
        <Pressable
          onPress={() => {
            onClose();
            onSeeAll();
          }}
          accessibilityRole="button"
          style={{ paddingVertical: 14, alignItems: 'center' }}
        >
          <Text style={[type.body, { color: c.accent.base }]}>See all Pis ›</Text>
        </Pressable>
      </View>
    </Modal>
  );
}
