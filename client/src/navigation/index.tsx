// Four tabs (§1.2): Dashboard · Control · Alerts · Settings. Agents are a
// context selector, not a navigation axis. Alerts tab badges unacknowledged
// count; Control shows a dot while a shell session runs.
import React, { useEffect } from 'react';
import * as Linking from 'expo-linking';
import { DarkTheme, DefaultTheme, NavigationContainer, getFocusedRouteNameFromRoute } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme';
import { useStore } from '../store/useStore';
import { startTunnel } from '../sim/tunnel';
import { DevicesHome } from '../screens/devices/DevicesHome';
import { ConnectScreen } from '../screens/devices/ConnectScreen';
import { WidgetGallery } from '../screens/widgets/WidgetGallery';

import { Welcome } from '../screens/onboarding/Welcome';
import { Install } from '../screens/onboarding/Install';
import { ScanQR } from '../screens/onboarding/ScanQR';
import { Verify } from '../screens/onboarding/Verify';
import { NamePi } from '../screens/onboarding/NamePi';
import { Permissions } from '../screens/onboarding/Permissions';

import { DashboardScreen } from '../screens/dashboard/DashboardScreen';
import { MetricDetail } from '../screens/dashboard/MetricDetail';
import { AgentList } from '../screens/dashboard/AgentList';
import { AgentDetail } from '../screens/dashboard/AgentDetail';
import { ControlHub } from '../screens/control/ControlHub';
import { ShellScreen } from '../screens/control/ShellScreen';
import { ActionsScreen } from '../screens/control/ActionsScreen';
import { RebootWatch } from '../screens/control/RebootWatch';
import { DesktopScreen } from '../screens/control/DesktopScreen';
import { AlertsList } from '../screens/alerts/AlertsList';
import { AlertDetail } from '../screens/alerts/AlertDetail';
import { RulesList } from '../screens/alerts/RulesList';
import { RuleEditor } from '../screens/alerts/RuleEditor';
import { SettingsScreen } from '../screens/settings/SettingsScreen';
import { DevicesKeys } from '../screens/settings/DevicesKeys';
import { Diagnostics } from '../screens/settings/Diagnostics';
import { SecuritySettings } from '../screens/settings/SecuritySettings';
import { AppearanceSettings } from '../screens/settings/AppearanceSettings';
import { DataSettings } from '../screens/settings/DataSettings';
import { SecurityLog } from '../screens/settings/SecurityLog';
import { SERIES } from '../sim/metrics';

const Stack = createNativeStackNavigator();
const Tabs = createBottomTabNavigator();

function useStackOptions() {
  const { c, type } = useTheme();
  return {
    headerStyle: { backgroundColor: c.surface.canvas },
    headerTintColor: c.text.primary,
    headerTitleStyle: { ...type.bodyEmph, color: c.text.primary },
    headerShadowVisible: false,
    contentStyle: { backgroundColor: c.surface.canvas },
  } as const;
}

function DevicesStack() {
  const opts = useStackOptions();
  return (
    <Stack.Navigator screenOptions={opts}>
      <Stack.Screen name="DevicesHome" component={DevicesHome} options={{ headerShown: false }} />
      <Stack.Screen name="Connect" component={ConnectScreen} options={{ headerShown: false, presentation: 'fullScreenModal' }} />
      <Stack.Screen name="AgentList" component={AgentList} options={{ title: 'Pis' }} />
      <Stack.Screen name="AgentDetail" component={AgentDetail} options={{ title: 'About this Pi' }} />
      <Stack.Screen name="Diagnostics" component={Diagnostics} />
      <Stack.Screen name="ScanQR" component={ScanQR} options={{ title: 'Pair' }} />
      <Stack.Screen name="Verify" component={Verify} options={{ title: 'Verify', headerBackVisible: false }} />
      <Stack.Screen name="NamePi" component={NamePi} options={{ title: 'Name', headerBackVisible: false }} />
      <Stack.Screen name="Permissions" component={Permissions} options={{ title: 'Almost done', headerBackVisible: false }} />
    </Stack.Navigator>
  );
}

function WidgetsStack() {
  const opts = useStackOptions();
  return (
    <Stack.Navigator screenOptions={opts}>
      <Stack.Screen name="WidgetGallery" component={WidgetGallery} options={{ headerShown: false }} />
    </Stack.Navigator>
  );
}

function DashboardStack() {
  const opts = useStackOptions();
  return (
    <Stack.Navigator screenOptions={opts}>
      <Stack.Screen name="Dashboard" component={DashboardScreen} options={{ headerShown: false }} />
      <Stack.Screen
        name="MetricDetail"
        component={MetricDetail}
        options={({ route }: any) => ({
          title: SERIES[route.params?.seriesKey as keyof typeof SERIES]?.title ?? 'Metric',
        })}
      />
      <Stack.Screen name="AgentList" component={AgentList} options={{ title: 'Pis' }} />
      <Stack.Screen name="AgentDetail" component={AgentDetail} options={{ title: 'About this Pi' }} />
      <Stack.Screen name="Diagnostics" component={Diagnostics} />
      <Stack.Screen name="ScanQR" component={ScanQR} options={{ title: 'Pair' }} />
      <Stack.Screen name="Verify" component={Verify} options={{ title: 'Verify', headerBackVisible: false }} />
      <Stack.Screen name="NamePi" component={NamePi} options={{ title: 'Name', headerBackVisible: false }} />
      <Stack.Screen name="Permissions" component={Permissions} options={{ title: 'Almost done', headerBackVisible: false }} />
    </Stack.Navigator>
  );
}

function ControlStack() {
  const opts = useStackOptions();
  return (
    <Stack.Navigator screenOptions={opts}>
      <Stack.Screen name="ControlHub" component={ControlHub} options={{ title: 'Control' }} />
      <Stack.Screen name="Shell" component={ShellScreen} options={{ title: 'pi5-livingroom · bash' }} />
      <Stack.Screen name="Desktop" component={DesktopScreen} options={{ headerShown: false, presentation: 'fullScreenModal' }} />
      <Stack.Screen name="Actions" component={ActionsScreen} />
      <Stack.Screen name="RebootWatch" component={RebootWatch} options={{ headerShown: false, presentation: 'fullScreenModal' }} />
      <Stack.Screen name="Diagnostics" component={Diagnostics} />
    </Stack.Navigator>
  );
}

function AlertsStack() {
  const opts = useStackOptions();
  return (
    <Stack.Navigator screenOptions={opts}>
      <Stack.Screen name="Alerts" component={AlertsList} />
      <Stack.Screen name="AlertDetail" component={AlertDetail} options={{ title: 'Alert detail' }} />
      <Stack.Screen name="Rules" component={RulesList} options={{ title: 'Alert Rules' }} />
      <Stack.Screen name="RuleEditor" component={RuleEditor} options={{ title: 'Rule' }} />
    </Stack.Navigator>
  );
}

function SettingsStack() {
  const opts = useStackOptions();
  return (
    <Stack.Navigator screenOptions={opts}>
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="DevicesKeys" component={DevicesKeys} options={{ title: 'Devices & keys' }} />
      <Stack.Screen name="SecuritySettings" component={SecuritySettings} options={{ title: 'Security' }} />
      <Stack.Screen name="AppearanceSettings" component={AppearanceSettings} options={{ title: 'Appearance' }} />
      <Stack.Screen name="DataSettings" component={DataSettings} options={{ title: 'Data & retention' }} />
      <Stack.Screen name="SecurityLog" component={SecurityLog} options={{ title: 'Security log' }} />
      <Stack.Screen name="Diagnostics" component={Diagnostics} />
      <Stack.Screen name="AgentList" component={AgentList} options={{ title: 'Pis' }} />
      <Stack.Screen name="AgentDetail" component={AgentDetail} options={{ title: 'About this Pi' }} />
      <Stack.Screen name="ScanQR" component={ScanQR} options={{ title: 'Pair' }} />
      <Stack.Screen name="Verify" component={Verify} options={{ title: 'Verify', headerBackVisible: false }} />
      <Stack.Screen name="NamePi" component={NamePi} options={{ title: 'Name', headerBackVisible: false }} />
      <Stack.Screen name="Permissions" component={Permissions} options={{ title: 'Almost done', headerBackVisible: false }} />
    </Stack.Navigator>
  );
}

// Floating pill tab bar in the Windows App style: a dark capsule bottom-left,
// active tab highlighted; Alerts and Settings are reachable from the Devices
// home's circular buttons, not the bar.
const PILL_TABS: { name: string; icon: keyof typeof Ionicons.glyphMap; label: string }[] = [
  { name: 'DevicesTab', icon: 'desktop-outline', label: 'Devices' },
  { name: 'MonitorTab', icon: 'speedometer-outline', label: 'Monitor' },
  { name: 'ControlTab', icon: 'flash-outline', label: 'Control' },
  { name: 'WidgetsTab', icon: 'grid-outline', label: 'Widgets' },
];

const TAB_ROOTS: Record<string, string> = {
  DevicesTab: 'DevicesHome',
  MonitorTab: 'Dashboard',
  ControlTab: 'ControlHub',
  WidgetsTab: 'WidgetGallery',
  AlertsTab: 'Alerts',
  SettingsTab: 'Settings',
};

function PillTabBar({ state, navigation }: any) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const shellOpen = useStore((s) => s.shellSessionStartedAt != null);
  const activeRoute = state.routes[state.index];
  const activeName = activeRoute?.name;

  // Like the reference app, the bar lives on the top-level surfaces only —
  // pushed screens (Shell, Actions, Metric detail…) get the full height.
  const focusedScreen = getFocusedRouteNameFromRoute(activeRoute) ?? TAB_ROOTS[activeName];
  if (focusedScreen !== TAB_ROOTS[activeName]) return null;

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        left: 16,
        right: 16,
        bottom: Math.max(insets.bottom, 12),
        flexDirection: 'row',
        alignItems: 'center',
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          backgroundColor: 'rgba(28,28,31,0.96)',
          borderRadius: 34,
          padding: 6,
          gap: 2,
        }}
      >
        {PILL_TABS.map((tab) => {
          const active = activeName === tab.name;
          return (
            <Pressable
              key={tab.name}
              onPress={() => navigation.navigate(tab.name)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: active ? 16 : 13,
                height: 52,
                borderRadius: 28,
                backgroundColor: active ? '#2E2E34' : 'transparent',
              }}
            >
              <View>
                <Ionicons name={tab.icon} size={21} color={active ? c.accent.base : '#B4B4BA'} />
                {tab.name === 'ControlTab' && shellOpen && (
                  <View
                    style={{
                      position: 'absolute',
                      right: -3,
                      top: -2,
                      width: 7,
                      height: 7,
                      borderRadius: 4,
                      backgroundColor: c.accent.base,
                    }}
                  />
                )}
              </View>
              {active && (
                <Text style={{ color: c.accent.base, fontSize: 13, fontWeight: '600', marginLeft: 7 }}>
                  {tab.label}
                </Text>
              )}
            </Pressable>
          );
        })}
      </View>

      <View style={{ flex: 1 }} />

      <Pressable
        onPress={() => navigation.navigate('SettingsTab')}
        accessibilityRole="button"
        accessibilityLabel="Settings"
        style={({ pressed }) => ({
          width: 58,
          height: 58,
          borderRadius: 29,
          backgroundColor: pressed ? '#2A2A2E' : 'rgba(28,28,31,0.96)',
          alignItems: 'center',
          justifyContent: 'center',
        })}
      >
        <Ionicons name="settings-outline" size={22} color="#EDEDF0" />
      </Pressable>
    </View>
  );
}

function MainTabs() {
  useEffect(() => {
    // Re-establish the tunnel if the app reloaded while paired.
    if (useStore.getState().connection.kind === 'unknown') startTunnel();
  }, []);

  return (
    <Tabs.Navigator
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <PillTabBar {...props} />}
    >
      <Tabs.Screen name="DevicesTab" component={DevicesStack} />
      <Tabs.Screen name="MonitorTab" component={DashboardStack} />
      <Tabs.Screen name="ControlTab" component={ControlStack} />
      <Tabs.Screen name="WidgetsTab" component={WidgetsStack} />
      <Tabs.Screen name="AlertsTab" component={AlertsStack} />
      <Tabs.Screen name="SettingsTab" component={SettingsStack} />
    </Tabs.Navigator>
  );
}

function OnboardingStack() {
  const opts = useStackOptions();
  return (
    <Stack.Navigator screenOptions={opts}>
      <Stack.Screen name="Welcome" component={Welcome} options={{ headerShown: false }} />
      <Stack.Screen name="Install" component={Install} options={{ title: 'Install' }} />
      <Stack.Screen name="ScanQR" component={ScanQR} options={{ title: 'Pair' }} />
      <Stack.Screen name="Verify" component={Verify} options={{ title: 'Verify', headerBackVisible: false }} />
      <Stack.Screen name="NamePi" component={NamePi} options={{ title: 'Name', headerBackVisible: false }} />
      <Stack.Screen name="Permissions" component={Permissions} options={{ title: 'Almost done', headerBackVisible: false }} />
    </Stack.Navigator>
  );
}

// Deep links (§1.4): pimon:// scheme; in Expo Go the same paths work as
// exp://<host>/--/<path>. Every link resolves against locally held state only.
const linking: any = {
  prefixes: [Linking.createURL('/'), 'pimon://'],
  config: {
    screens: {
      DevicesTab: {
        screens: {
          DevicesHome: 'home',
          Connect: 'connect/:agentId',
          AgentList: 'agents',
          AgentDetail: 'agent/:agentId',
        },
      },
      WidgetsTab: {
        screens: {
          WidgetGallery: 'widgets',
        },
      },
      MonitorTab: {
        screens: {
          Dashboard: 'dashboard',
          MetricDetail: 'metric/:seriesKey',
          Diagnostics: 'diagnostics',
        },
      },
      ControlTab: {
        screens: {
          ControlHub: 'control',
          Shell: 'shell',
          Desktop: 'desktop',
          Actions: 'actions',
        },
      },
      AlertsTab: {
        screens: {
          Alerts: 'alerts',
          AlertDetail: 'alert/:alertId',
          Rules: 'rules',
          RuleEditor: 'rule',
        },
      },
      SettingsTab: {
        screens: {
          Settings: 'settings',
          DevicesKeys: 'settings/devices',
          SecuritySettings: 'settings/security',
          AppearanceSettings: 'settings/appearance',
          DataSettings: 'settings/data',
          SecurityLog: 'settings/log',
          Diagnostics: 'settings/diagnostics',
        },
      },
    },
  },
};

/** Dev/testing hook: `…/--/demo/pair` pairs a demo Pi without the camera. */
function useDemoPairLink() {
  const url = Linking.useURL();
  useEffect(() => {
    if (!url) return;
    const { path } = Linking.parse(url);
    if (path === 'demo/pair' && !useStore.getState().paired) {
      const now = Date.now();
      const { DEFAULT_RULES, DEFAULT_ACTIONS } = require('../sim/seed');
      const { wordsFromHex, randomHex } = require('../lib/fingerprint');
      const hex = randomHex(32);
      useStore.getState().set({ rules: DEFAULT_RULES, actions: DEFAULT_ACTIONS });
      useStore.getState().pairAgent({
        id: `agent-${now}`,
        name: 'pi5-livingroom',
        hostname: 'pi5-livingroom',
        model: 'Raspberry Pi 5 · 8 GB',
        os: 'Raspberry Pi OS Trixie (64-bit)',
        agentVersion: '1.0.0',
        fingerprintHex: hex,
        fingerprintWords: wordsFromHex(hex),
        pairedAt: now,
        verifiedAt: now,
      });
      startTunnel();
    }
  }, [url]);
}

export function RootNavigation() {
  const { c, isDark } = useTheme();
  const paired = useStore((s) => s.paired);
  useDemoPairLink();

  const navTheme = {
    ...(isDark ? DarkTheme : DefaultTheme),
    colors: {
      ...(isDark ? DarkTheme : DefaultTheme).colors,
      background: c.surface.canvas,
      card: c.surface.canvas,
      text: c.text.primary,
      primary: c.accent.base,
      border: c.border.hairline,
    },
  };

  return (
    <NavigationContainer theme={navTheme} linking={paired ? linking : undefined}>
      {paired ? <MainTabs /> : <OnboardingStack />}
    </NavigationContainer>
  );
}
