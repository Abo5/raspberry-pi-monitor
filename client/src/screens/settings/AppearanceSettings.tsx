// Settings → Appearance (§14). Dark is the designed-first appearance; the
// terminal is always dark by default (§2.2 exception).
import React from 'react';
import { Pressable, Switch, Text, View } from 'react-native';
import { useTheme, withAlpha } from '../../theme';
import { useStore } from '../../store/useStore';
import { Screen, Card, ListRow, Eyebrow } from '../../components/Shared';

export function AppearanceSettings() {
  const { c, type, radius } = useTheme();
  const settings = useStore((s) => s.settings);
  const setSettings = useStore((s) => s.setSettings);

  return (
    <Screen>
      <Eyebrow>THEME</Eyebrow>
      <View
        style={{
          flexDirection: 'row',
          backgroundColor: c.surface.raised,
          borderRadius: radius.s,
          borderWidth: 1,
          borderColor: c.border.subtle,
          padding: 2,
        }}
      >
        {(['system', 'dark', 'light'] as const).map((t) => {
          const selected = settings.theme === t;
          return (
            <Pressable
              key={t}
              onPress={() => setSettings({ theme: t })}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              style={{
                flex: 1,
                height: 34,
                borderRadius: radius.s - 2,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: selected ? withAlpha(c.accent.base, c.accent.washAlpha) : 'transparent',
              }}
            >
              <Text
                style={[
                  type.subhead,
                  {
                    color: selected ? c.accent.base : c.text.secondary,
                    fontWeight: '600',
                    textTransform: 'capitalize',
                  },
                ]}
              >
                {t}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={[type.footnote, { color: c.text.tertiary, marginTop: 8 }]}>
        Dark is the designed-first appearance.
      </Text>

      <Eyebrow>TERMINAL</Eyebrow>
      <Card>
        <ListRow
          title="Terminal font size"
          value={`${settings.terminalFontSize}pt`}
          onPress={() =>
            setSettings({
              terminalFontSize: settings.terminalFontSize >= 20 ? 9 : settings.terminalFontSize + 1,
            })
          }
        />
        <ListRow title="Terminal theme" value="Always dark" last />
      </Card>

      <Eyebrow>CHARTS</Eyebrow>
      <Card>
        <ListRow
          title="Animate chart updates"
          right={
            <Switch
              value={settings.animateCharts}
              onValueChange={(v) => setSettings({ animateCharts: v })}
              trackColor={{ true: c.accent.base }}
              style={{ transform: [{ scale: 0.8 }] }}
            />
          }
          last
        />
      </Card>
    </Screen>
  );
}
