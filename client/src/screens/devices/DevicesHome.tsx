// Raspberry App — Devices home, in the original Windows App visual language
// (dark canvas, circular top buttons, "Saved Devices" headline, big rounded
// device cards with the bloom-wave artwork) — now with frosted-glass surfaces:
// the round buttons, the card chips and the card edge are real glass.
// Tap a device → its desktop; the ⋯ on a card offers Desktop or SSH terminal.
import React, { useEffect, useState } from 'react';
import { ActionSheetIOS, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useTheme } from '../../theme';
import { connectLive, useStore } from '../../store/useStore';
import { WaveBackground } from '../../components/WaveBackground';
import { GlassBackground } from '../../components/Glass';
import { EmptyState } from '../../components/States';
import { fmtTemp, fmtPct } from '../../lib/format';

const VARIANTS = ['magenta', 'cyan', 'violet', 'ember'] as const;

/** Frosted chip laid over the wave artwork. */
function GlassChip({ children }: { children: React.ReactNode }) {
  return (
    <View
      style={{
        borderRadius: 18, overflow: 'hidden', paddingHorizontal: 14, paddingVertical: 8,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)', backgroundColor: 'rgba(20,20,24,0.25)',
      }}
    >
      <BlurView intensity={35} tint="dark" style={StyleSheet.absoluteFill} />
      {children}
    </View>
  );
}

/** Glass status chip: green dot + Connected, or grey dot + Offline. */
function StatusChip({ online }: { online: boolean }) {
  return (
    <GlassChip>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: online ? '#2FB463' : '#7A8A94' }} />
        <Text style={{ color: online ? '#FFFFFF' : '#C9C9CE', fontSize: 13, fontWeight: '600' }}>
          {online ? 'Connected' : 'Offline'}
        </Text>
      </View>
    </GlassChip>
  );
}

/** Darkens the bottom of a desktop picture so the device name stays readable. */
function PhotoScrim({ width, height }: { width: number; height: number }) {
  return (
    <Svg width={width} height={height} style={{ position: 'absolute' }}>
      <Defs>
        <LinearGradient id="scrim" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#000" stopOpacity={0.35} />
          <Stop offset="0.35" stopColor="#000" stopOpacity={0} />
          <Stop offset="0.55" stopColor="#000" stopOpacity={0.1} />
          <Stop offset="1" stopColor="#000" stopOpacity={0.85} />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width={width} height={height} fill="url(#scrim)" />
    </Svg>
  );
}

function WaveCard({
  index, width, height, title, subtitle, online, onPress, onLongPress, onMore, photo,
}: {
  index: number; width: number; height: number; title: string; subtitle?: string; online: boolean;
  onPress: () => void; onLongPress?: () => void; onMore?: () => void;
  /** Last picture of this Pi's desktop (this app run only) — replaces the artwork. */
  photo?: string;
}) {
  const { type } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityLabel={`Connect to ${title}`}
      style={({ pressed }) => ({
        width, height, borderRadius: 24, overflow: 'hidden',
        backgroundColor: '#111114',
        // glass edge
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
        transform: [{ scale: pressed ? 0.985 : 1 }],
      })}
    >
      {photo ? (
        <>
          <Image source={{ uri: photo }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          <PhotoScrim width={width} height={height} />
        </>
      ) : (
        <WaveBackground width={width} height={height} variant={VARIANTS[index % VARIANTS.length]} bottomScrim={height * 0.5} />
      )}
      <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.22)' }} />

      <View style={{ flexDirection: 'row', padding: 14, alignItems: 'center' }}>
        <View style={{ flex: 1 }} />
        <StatusChip online={online} />
        {onMore && <View style={{ width: 8 }} />}
        {onMore && (
          <Pressable onPress={onMore} hitSlop={10} accessibilityRole="button" accessibilityLabel={`More for ${title}`}>
            <View style={{ width: 36, height: 36, borderRadius: 18, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)', backgroundColor: 'rgba(20,20,24,0.25)' }}>
              <BlurView intensity={35} tint="dark" style={StyleSheet.absoluteFill} />
              <Ionicons name="ellipsis-horizontal" size={18} color="#FFFFFF" />
            </View>
          </Pressable>
        )}
      </View>

      {/* bottom label — sits over the wave's fade */}
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 18, paddingBottom: 18 }}>
        <Text style={[type.title2, { color: '#FFFFFF' }]} numberOfLines={1}>{title}</Text>
        {!!subtitle && <Text style={[type.subhead, { color: '#C9C9CE', marginTop: 3 }]} numberOfLines={1}>{subtitle}</Text>}
      </View>
    </Pressable>
  );
}

export function DevicesHome() {
  const { type } = useTheme();
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const agents = useStore((s) => s.agents);
  const currentId = useStore((s) => s.currentAgentId);
  const snapshot = useStore((s) => s.snapshot);
  const connection = useStore((s) => s.connection);
  const endpoints = useStore((s) => s.endpoints);
  const connectStatus = useStore((s) => s.connectStatus);
  const connectDevices = useStore((s) => s.connectDevices);
  const snapshots = useStore((s) => s.deviceSnapshots);
  const setStore = useStore((s) => s.set);
  const [refreshing, setRefreshing] = useState(false);
  // Saved devices show at once on launch while the session is re-checked.
  const signedIn = useStore(connectLive);

  const openConnect = (url: string, name: string, mode: 'gui' | 'ssh' = 'gui') =>
    nav.navigate('ConnectDevices', { url, title: name, mode });
  const deviceMenu = (url: string, name: string) =>
    ActionSheetIOS.showActionSheetWithOptions(
      { title: name, options: ['Desktop (GUI)', 'SSH terminal', 'Cancel'], cancelButtonIndex: 2, userInterfaceStyle: 'dark' },
      (i) => {
        if (i === 0) openConnect(url, name, 'gui');
        else if (i === 1) openConnect(url, name, 'ssh');
      },
    );

  const onRefresh = () => {
    setRefreshing(true);
    setStore({ connectCheckNonce: useStore.getState().connectCheckNonce + 1 });
    setTimeout(() => setRefreshing(false), 1500);
  };

  // Keep the Connected / Offline status fresh: re-read the account's devices
  // every minute while this screen is showing.
  const isFocused = useIsFocused();
  useEffect(() => {
    if (!signedIn || !isFocused) return;
    const t = setInterval(() => {
      setStore({ connectCheckNonce: useStore.getState().connectCheckNonce + 1 });
    }, 60_000);
    return () => clearInterval(t);
  }, [signedIn, isFocused, setStore]);

  const cardW = width - 32;
  const cardH = 236;
  const hasDevices = (signedIn && connectDevices.length > 0) || agents.length > 0;

  return (
    <View style={{ flex: 1, backgroundColor: '#000000', paddingTop: insets.top }}>
      <GlassBackground base="#000000" strength={0.9} />

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 140 }}
        refreshControl={signedIn ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFFFFF" /> : undefined}
      >
        {/* Raspberry Pi Connect sign-in — only while there's no live session */}
        {!signedIn && (
          <Pressable onPress={() => nav.navigate('ConnectLogin')} accessibilityRole="button" accessibilityLabel="Sign in with Raspberry Pi Connect">
            {({ pressed }) => (
              <View
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 20, marginBottom: 22,
                  overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)',
                  backgroundColor: pressed ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.06)',
                }}
              >
                <BlurView intensity={35} tint="dark" style={StyleSheet.absoluteFill} />
                <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: '#C51A4A', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="cloud" size={23} color="#FFFFFF" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[type.body, { color: '#FFFFFF', fontWeight: '700' }]}>Sign in with Raspberry Pi Connect</Text>
                  <Text style={[type.caption, { color: '#B4B4BA', marginTop: 2 }]} numberOfLines={1}>Use your Raspberry Pi account to reach your Pis</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#8A8A90" />
              </View>
            )}
          </Pressable>
        )}

        <Text style={[type.display, { color: '#FFFFFF', fontSize: 30, marginBottom: 14 }]}>Saved Devices</Text>

        {!hasDevices ? (
          <EmptyState
            icon="server-outline"
            title="No Pis yet"
            body={signedIn ? 'Add a Pi to your Raspberry Pi Connect account, then pull down to refresh.' : 'Sign in with Raspberry Pi Connect to see your Pis here.'}
          />
        ) : (
          <View style={{ gap: 16 }}>
            {signedIn && connectDevices.map((d, i) => (
              <WaveCard
                key={d.id}
                index={i}
                width={cardW}
                height={cardH}
                title={d.name}
                online={d.online}
                photo={snapshots[d.url.replace(/\/$/, '')]}
                onPress={() => openConnect(d.url, d.name, 'gui')}
                onLongPress={() => deviceMenu(d.url, d.name)}
                onMore={() => deviceMenu(d.url, d.name)}
              />
            ))}
            {agents.map((agent, i) => {
              const v = agent.id === currentId ? snapshot?.values : null;
              const ep = endpoints[agent.id];
              const metrics = v
                ? [
                    v['cpu.temp_c'] != null ? `${fmtTemp(v['cpu.temp_c'])}°C` : null,
                    v['cpu.util_pct'] != null ? `CPU ${fmtPct(v['cpu.util_pct'])}%` : null,
                  ].filter(Boolean).join(' · ')
                : '';
              return (
                <WaveCard
                  key={agent.id}
                  index={(signedIn ? connectDevices.length : 0) + i}
                  width={cardW}
                  height={cardH}
                  title={agent.name}
                  subtitle={`${ep ? `${ep.ip}:${ep.port}` : `${agent.hostname}.local`}${metrics ? `   ·   ${metrics}` : ''}`}
                  online={agent.id === currentId && connection.kind === 'connected'}
                  onPress={() => nav.navigate('Connect', { agentId: agent.id })}
                  onLongPress={() => nav.navigate('AgentDetail', { agentId: agent.id })}
                />
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
