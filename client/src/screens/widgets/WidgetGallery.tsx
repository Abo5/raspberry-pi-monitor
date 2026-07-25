// Widget gallery: every design, grouped by WidgetKit family, rendered live.
// Tap to add/remove from "My widgets" (persisted). Lock-screen families render
// on a wallpaper-ish backdrop so the monochrome style reads in context.
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { useStore } from '../../store/useStore';
import { CATALOG, FAMILY_META, WidgetFamily, WidgetPreview } from '../../widgets/catalog';
import { WaveBackground } from '../../components/WaveBackground';

const FAMILIES: WidgetFamily[] = ['small', 'medium', 'circular', 'rectangular', 'inline'];
const LOCK: WidgetFamily[] = ['circular', 'rectangular', 'inline'];

export function WidgetGallery() {
  const { type } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const agent = useStore((s) => s.agents.find((a) => a.id === s.currentAgentId));
  const selected = useStore((s) => s.selectedWidgets);
  const toggleWidget = useStore((s) => s.toggleWidget);
  const snapshot = useStore((s) => s.snapshot);
  const [, setTick] = useState(0);

  // Previews re-render on each Snapshot so the numbers are alive.
  useEffect(() => {
    setTick((n) => n + 1);
  }, [snapshot?.receivedAt]);

  const agentName = agent?.name ?? 'pi5-livingroom';

  return (
    <View style={{ flex: 1, backgroundColor: '#000000', paddingTop: insets.top }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 140 }}>
        <Text style={[type.display, { color: '#FFFFFF', fontSize: 30 }]}>Widgets</Text>
        <Text style={[type.subhead, { color: '#9A9AA0', marginTop: 4 }]}>
          {selected.length === 0
            ? 'Pick the widgets you want on your Home and Lock Screen.'
            : `${selected.length} selected — they ship to your Home and Lock Screen with the native build.`}
        </Text>

        {FAMILIES.map((family) => {
          const meta = FAMILY_META[family];
          const designs = CATALOG.filter((d) => d.family === family);
          const isLock = LOCK.includes(family);
          return (
            <View key={family}>
              <Text style={[type.title3, { color: '#FFFFFF', marginTop: 28 }]}>{meta.title}</Text>
              <Text style={[type.footnote, { color: '#9A9AA0', marginTop: 2, marginBottom: 12 }]}>{meta.blurb}</Text>

              {isLock ? (
                // Lock-screen strip: wallpaper backdrop behind monochrome widgets
                <View style={{ borderRadius: 24, overflow: 'hidden' }}>
                  <WaveBackground width={width - 32} height={Math.ceil(designs.length / rowFit(family, width)) * (meta.h + 46) + 20} variant="violet" dim />
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', padding: 10, gap: 4 }}>
                    {designs.map((d) => (
                      <WidgetCell
                        key={d.id}
                        id={d.id}
                        name={d.name}
                        w={meta.w}
                        selected={selected.includes(d.id)}
                        onPress={() => toggleWidget(d.id)}
                        agentName={agentName}
                        onWallpaper
                      />
                    ))}
                  </View>
                </View>
              ) : (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                  {designs.map((d) => (
                    <WidgetCell
                      key={d.id}
                      id={d.id}
                      name={d.name}
                      w={meta.w}
                      selected={selected.includes(d.id)}
                      onPress={() => toggleWidget(d.id)}
                      agentName={agentName}
                    />
                  ))}
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

function rowFit(family: WidgetFamily, screenW: number): number {
  const w = FAMILY_META[family].w + 12;
  return Math.max(1, Math.floor((screenW - 52) / w));
}

function WidgetCell({
  id, name, w, selected, onPress, agentName, onWallpaper,
}: {
  id: string;
  name: string;
  w: number;
  selected: boolean;
  onPress: () => void;
  agentName: string;
  onWallpaper?: boolean;
}) {
  const { type } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={({ pressed }) => ({
        alignItems: 'center',
        padding: 6,
        borderRadius: 20,
        transform: [{ scale: pressed ? 0.97 : 1 }],
      })}
    >
      <View>
        <WidgetPreview id={id} agentName={agentName} />
        {selected && (
          <View
            style={{
              position: 'absolute',
              top: -6,
              right: -6,
              width: 24,
              height: 24,
              borderRadius: 12,
              backgroundColor: '#2FBCCF',
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 2,
              borderColor: '#000000',
            }}
          >
            <Ionicons name="checkmark" size={14} color="#04191C" />
          </View>
        )}
      </View>
      <Text
        style={[
          type.caption,
          { color: onWallpaper ? 'rgba(255,255,255,0.85)' : '#9A9AA0', marginTop: 6, maxWidth: w },
        ]}
        numberOfLines={1}
      >
        {name}
      </Text>
    </Pressable>
  );
}
