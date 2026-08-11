// The destructive-action confirmation pattern (§17.1): consequence sheet naming
// the target, a slide-to-confirm track inert for 480ms requiring ≥80% travel,
// then (on device) biometric auth. Never a generic "Are you sure?" alert.
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Modal, PanResponder, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme';
import { ActionButton } from './ActionButton';

interface Props {
  visible: boolean;
  title: string; // "Reboot pi5-livingroom" — the Agent name never truncates
  consequence: string;
  facts: [string, string][]; // Command / Downtime / Affects
  slideLabel: string; // "slide to reboot"
  onConfirm: () => void;
  onCancel: () => void;
}

const TRACK_H = 50;
const KNOB = 42;

export function DestructiveConfirm({ visible, title, consequence, facts, slideLabel, onConfirm, onCancel }: Props) {
  const { c, type, radius, motion } = useTheme();
  const [armed, setArmed] = useState(false);
  const dragX = useRef(new Animated.Value(0)).current;
  const armedRef = useRef(false);
  const trackWRef = useRef(0);

  useEffect(() => {
    if (!visible) return;
    setArmed(false);
    armedRef.current = false;
    dragX.setValue(0);
    const t = setTimeout(() => {
      setArmed(true);
      armedRef.current = true;
    }, motion.deliberate); // inert for the first 480ms
    return () => clearTimeout(t);
  }, [visible]);

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => armedRef.current,
      onMoveShouldSetPanResponder: () => armedRef.current,
      onPanResponderGrant: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid),
      onPanResponderMove: (_, g) => {
        const max = trackWRef.current - KNOB - 8;
        dragX.setValue(Math.min(max, Math.max(0, g.dx)));
      },
      onPanResponderRelease: (_, g) => {
        const max = trackWRef.current - KNOB - 8;
        if (g.dx >= max * 0.8) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          onConfirmRef.current();
        } else {
          Animated.spring(dragX, { toValue: 0, useNativeDriver: false, damping: 20 }).start();
        }
      },
    }),
  ).current;

  const onConfirmRef = useRef(onConfirm);
  onConfirmRef.current = onConfirm;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <View style={{ flex: 1, backgroundColor: c.surface.scrim, justifyContent: 'flex-end' }}>
        <View
          style={{
            backgroundColor: c.surface.raised2,
            borderTopLeftRadius: radius.xl,
            borderTopRightRadius: radius.xl,
            padding: 20,
            paddingBottom: 40,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="warning-outline" size={22} color={c.status.critical} />
            <Text style={[type.title2, { color: c.text.primary, marginLeft: 8, flex: 1 }]}>{title}</Text>
          </View>
          <Text style={[type.callout, { color: c.text.secondary, marginTop: 12 }]}>{consequence}</Text>

          <View
            style={{
              backgroundColor: c.surface.sunken,
              borderRadius: radius.s,
              padding: 12,
              marginTop: 16,
              gap: 6,
            }}
          >
            {facts.map(([k, v]) => (
              <View key={k} style={{ flexDirection: 'row' }}>
                <Text style={[type.micro, { color: c.text.tertiary, width: 80, paddingTop: 3 }]}>{k}</Text>
                <Text style={[type.monoBody, { color: c.text.primary, flex: 1 }]}>{v}</Text>
              </View>
            ))}
          </View>

          <View
            onLayout={(e) => {
              trackWRef.current = e.nativeEvent.layout.width;
            }}
            style={{
              height: TRACK_H,
              borderRadius: radius.s,
              backgroundColor: c.status.critical,
              opacity: armed ? 1 : 0.5,
              marginTop: 20,
              justifyContent: 'center',
            }}
          >
            <Text style={[type.bodyEmph, { color: c.text.onCritical, textAlign: 'center' }]}>
              ▸▸▸  {slideLabel}
            </Text>
            <Animated.View
              {...pan.panHandlers}
              style={{
                position: 'absolute',
                left: 4,
                top: 4,
                width: KNOB,
                height: KNOB,
                borderRadius: radius.s - 2,
                backgroundColor: c.text.onCritical,
                alignItems: 'center',
                justifyContent: 'center',
                transform: [{ translateX: dragX }],
              }}
            >
              <Ionicons name="chevron-forward" size={20} color={c.status.critical} />
            </Animated.View>
          </View>

          <ActionButton label="Cancel" variant="tertiary" onPress={onCancel} style={{ marginTop: 12 }} />
        </View>
      </View>
    </Modal>
  );
}
