// Four tabs (§1.2): Dashboard · Control · Alerts · Settings. Agents are a
// context selector, not a navigation axis. Alerts tab badges unacknowledged
// count; Control shows a dot while a shell session runs.
import React, { useEffect } from 'react';
import * as Linking from 'expo-linking';
import { DarkTheme, DefaultTheme, NavigationContainer, createNavigationContainerRef, getFocusedRouteNameFromRoute } from '@react-navigation/native';
import { CAPTURE_ENABLED, CAPTURE_FIRST_MS, CAPTURE_STEP_MS, CAPTURE_STEPS } from '../dev/capture';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Defs, LinearGradient as SvgGradient, Rect, Stop } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme';
import { useStore } from '../store/useStore';
import { connectAgent } from '../net/transport';
import { DevicesHome } from '../screens/devices/DevicesHome';
import { ConnectScreen } from '../screens/devices/ConnectScreen';
import { GlassLogin } from '../screens/devices/GlassLogin';
import { AddRealPi } from '../screens/devices/AddRealPi';
import { RemoteSession } from '../screens/devices/RemoteSession';
import { WidgetGallery } from '../screens/widgets/WidgetGallery';

import { Welcome } from '../screens/onboarding/Welcome';
import { Install } from '../screens/onboarding/Install';

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
import { SERIES } from '../lib/series';

const Stack = createNativeStackNavigator();
const Tabs = createBottomTabNavigator();

function useStackOptions() {
  const { c, type } = useTheme();
  return {
    headerStyle: { backgroundColor: c.surface.canvas },
    headerTintColor: c.text.primary,
    headerTitleStyle: { ...type.bodyEmph, color: c.text.primary },
    headerShadowVisible: false,
    // Chevron-only back button — avoids route-name labels like "DevicesHome".
    headerBackButtonDisplayMode: 'minimal',
    contentStyle: { backgroundColor: c.surface.canvas },
  } as const;
}

function DevicesStack() {
  const opts = useStackOptions();
  return (
    <Stack.Navigator screenOptions={opts}>
      <Stack.Screen name="DevicesHome" component={DevicesHome} options={{ headerShown: false }} />
      <Stack.Screen name="GlassLogin" component={GlassLogin} options={{ headerShown: false, presentation: 'fullScreenModal' }} />
      <Stack.Screen name="AddRealPi" component={AddRealPi} options={{ headerShown: false, presentation: 'fullScreenModal' }} />
      <Stack.Screen name="Connect" component={ConnectScreen} options={{ headerShown: false, presentation: 'fullScreenModal' }} />
      <Stack.Screen name="RemoteSession" component={RemoteSession} options={{ headerShown: false, presentation: 'fullScreenModal', gestureEnabled: false }} />
      <Stack.Screen name="AgentList" component={AgentList} options={{ title: 'Pis' }} />
      <Stack.Screen name="AgentDetail" component={AgentDetail} options={{ title: 'About this Pi' }} />
      <Stack.Screen name="Diagnostics" component={Diagnostics} />
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
      <Stack.Screen name="AddRealPi" component={AddRealPi} options={{ headerShown: false, presentation: 'fullScreenModal' }} />
    </Stack.Navigator>
  );
}

function ControlStack() {
  const opts = useStackOptions();
  return (
    <Stack.Navigator screenOptions={opts}>
      <Stack.Screen name="ControlHub" component={ControlHub} options={{ title: 'Control' }} />
      <Stack.Screen name="Shell" component={ShellScreen} options={{ title: 'Shell' }} />
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
      <Stack.Screen name="AddRealPi" component={AddRealPi} options={{ headerShown: false, presentation: 'fullScreenModal' }} />
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
  const { width } = useWindowDimensions();
  const shellOpen = useStore((s) => s.shellSessionStartedAt != null);
  const activeRoute = state.routes[state.index];
  const activeName = activeRoute?.name;

  // Like the reference app, the bar lives on the top-level surfaces only —
  // pushed screens (Shell, Actions, Metric detail…) get the full height.
  const focusedScreen = getFocusedRouteNameFromRoute(activeRoute) ?? TAB_ROOTS[activeName];
  if (focusedScreen !== TAB_ROOTS[activeName]) return null;

  const fadeH = Math.max(insets.bottom, 12) + 58 + 28;

  return (
    <>
      {/* Bottom fade so scroll content dissolves behind the bar instead of
          being hard-clipped by it. */}
      <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: fadeH }}>
        <Svg width={width} height={fadeH}>
          <Defs>
            <SvgGradient id="tabfade" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#000000" stopOpacity={0} />
              <Stop offset="0.55" stopColor="#000000" stopOpacity={0.7} />
              <Stop offset="1" stopColor="#000000" stopOpacity={0.96} />
            </SvgGradient>
          </Defs>
          <Rect x={0} y={0} width={width} height={fadeH} fill="url(#tabfade)" />
        </Svg>
      </View>
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
    </>
  );
}

function MainTabs() {
  useEffect(() => {
    // Re-establish the connection if the app reloaded while paired.
    if (useStore.getState().connection.kind === 'unknown') {
      connectAgent(useStore.getState().currentAgentId);
    }
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
      <Stack.Screen name="AddRealPi" component={AddRealPi} options={{ headerShown: false, presentation: 'fullScreenModal' }} />
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
          GlassLogin: 'signin/:agentId',
          Connect: 'connect/:agentId',
          RemoteSession: 'remote/:agentId',
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


const navigationRef = createNavigationContainerRef<any>();

/** Dev-only: walks every screen on a timer so a full screenshot set can be
 * captured without taps. No-op unless CAPTURE_ENABLED (src/dev/capture.ts). */
function useCaptureRunner() {
  useEffect(() => {
    if (!CAPTURE_ENABLED) return;
    let i = 0;
    const go = () => {
      const step = CAPTURE_STEPS[i % CAPTURE_STEPS.length];
      if (navigationRef.isReady()) navigationRef.navigate(step.target[0], step.target[1]);
      // eslint-disable-next-line no-console
      console.log(`[capture] ${step.name}`);
      i++;
    };
    // Fixed first-nav delay so an external screenshot loop can phase-lock.
    let started = false;
    const first = setTimeout(() => {
      started = true;
      go();
    }, CAPTURE_FIRST_MS);
    const t = setInterval(() => {
      if (started) go();
    }, CAPTURE_STEP_MS);
    return () => {
      clearInterval(t);
      clearTimeout(first);
    };
  }, []);
}

export function RootNavigation() {
  const { c, isDark } = useTheme();
  const paired = useStore((s) => s.paired);
  useCaptureRunner();

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
    <NavigationContainer ref={navigationRef} theme={navTheme} linking={paired && !CAPTURE_ENABLED ? linking : undefined}>
      {paired ? <MainTabs /> : <OnboardingStack />}
    </NavigationContainer>
  );
}
