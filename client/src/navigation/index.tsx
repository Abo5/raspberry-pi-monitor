// Four tabs (§1.2): Dashboard · Control · Alerts · Settings. Agents are a
// context selector, not a navigation axis. Alerts tab badges unacknowledged
// count; Control shows a dot while a shell session runs.
import * as ScreenOrientation from 'expo-screen-orientation';
import React, { useEffect, useRef } from 'react';
import * as Linking from 'expo-linking';
import { DarkTheme, DefaultTheme, NavigationContainer, createNavigationContainerRef, getFocusedRouteNameFromRoute } from '@react-navigation/native';
import { CAPTURE_ENABLED, CAPTURE_FIRST_MS, CAPTURE_STEP_MS, CAPTURE_STEPS } from '../dev/capture';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme';
import { useStore, connectLive } from '../store/useStore';
import { connectAgent } from '../net/transport';
import { DevicesHome } from '../screens/devices/DevicesHome';
import { ConnectDevices } from '../screens/connect/ConnectDevices';
import { ConnectLoginScreen } from '../screens/connect/ConnectLoginScreen';
import { connectSignOutReason } from '../net/connect';
import { ConnectScreen } from '../screens/devices/ConnectScreen';
import { GlassLogin } from '../screens/devices/GlassLogin';
import { AddRealPi } from '../screens/devices/AddRealPi';
import { RemoteSession } from '../screens/devices/RemoteSession';
import { WidgetGallery } from '../screens/widgets/WidgetGallery';

import { Welcome } from '../screens/onboarding/Welcome';
import { Install } from '../screens/onboarding/Install';

import { DashboardScreen } from '../screens/dashboard/DashboardScreen';
import { LiveCommandsScreen } from '../screens/dashboard/LiveCommands';
import { MetricDetail } from '../screens/dashboard/MetricDetail';
import { AgentList } from '../screens/dashboard/AgentList';
import { SshMonitorSetup } from '../screens/dashboard/SshMonitorSetup';
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
  const { c, type, isDark } = useTheme();
  return {
    // Dark: a see-through frosted header floating over the glass backdrop, so
    // pushed pages match the Devices home instead of sitting under a flat bar.
    headerTransparent: isDark,
    headerBlurEffect: isDark ? ('systemUltraThinMaterialDark' as const) : undefined,
    headerStyle: { backgroundColor: isDark ? 'transparent' : c.surface.canvas },
    headerTintColor: c.text.primary,
    headerTitleStyle: { ...type.bodyEmph, color: c.text.primary },
    headerShadowVisible: false,
    // Chevron-only back button — avoids route-name labels like "DevicesHome".
    headerBackButtonDisplayMode: 'minimal',
    contentStyle: { backgroundColor: c.surface.canvas },
  } as const;
}

// Screens that lay out their own content (no <Screen>) keep an opaque header,
// so nothing slides under it.
const SOLID_HEADER = { headerTransparent: false, headerBlurEffect: undefined, headerStyle: { backgroundColor: '#000000' } } as const;

function DevicesStack() {
  const opts = useStackOptions();
  return (
    <Stack.Navigator screenOptions={opts}>
      <Stack.Screen name="DevicesHome" component={DevicesHome} options={{ headerShown: false }} />
      <Stack.Screen name="ConnectDevices" component={ConnectDevices} options={{ headerShown: false }} />
      <Stack.Screen name="ConnectLogin" component={ConnectLoginScreen} options={{ headerShown: false, animation: 'slide_from_bottom', gestureEnabled: false }} />
      <Stack.Screen name="GlassLogin" component={GlassLogin} options={{ headerShown: false, animation: 'slide_from_bottom' }} />
      <Stack.Screen name="AddRealPi" component={AddRealPi} options={{ headerShown: false, animation: 'slide_from_bottom' }} />
      <Stack.Screen name="Connect" component={ConnectScreen} options={{ headerShown: false, animation: 'slide_from_bottom' }} />
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
      <Stack.Screen name="LiveCommands" component={LiveCommandsScreen} options={{ title: 'Live Commands', ...SOLID_HEADER }} />
      <Stack.Screen
        name="MetricDetail"
        component={MetricDetail}
        options={({ route }: any) => ({
          title: SERIES[route.params?.seriesKey as keyof typeof SERIES]?.title ?? 'Metric',
          ...SOLID_HEADER,
        })}
      />
      <Stack.Screen name="AgentList" component={AgentList} options={{ title: 'Pis' }} />
      <Stack.Screen name="AgentDetail" component={AgentDetail} options={{ title: 'About this Pi' }} />
      <Stack.Screen name="Diagnostics" component={Diagnostics} />
      <Stack.Screen name="AddRealPi" component={AddRealPi} options={{ headerShown: false, animation: 'slide_from_bottom' }} />
      <Stack.Screen name="SshMonitorSetup" component={SshMonitorSetup} options={{ headerShown: false, animation: 'slide_from_bottom' }} />
    </Stack.Navigator>
  );
}

function ControlStack() {
  const opts = useStackOptions();
  return (
    <Stack.Navigator screenOptions={opts}>
      <Stack.Screen name="ControlHub" component={ControlHub} options={{ headerShown: false }} />
      <Stack.Screen name="Shell" component={ShellScreen} options={{ title: 'Shell', ...SOLID_HEADER }} />
      <Stack.Screen name="Desktop" component={DesktopScreen} options={{ headerShown: false, animation: 'slide_from_bottom' }} />
      <Stack.Screen name="Actions" component={ActionsScreen} />
      <Stack.Screen name="RebootWatch" component={RebootWatch} options={{ headerShown: false, animation: 'slide_from_bottom' }} />
      <Stack.Screen name="Diagnostics" component={Diagnostics} />
    </Stack.Navigator>
  );
}

function HeaderClose({ onPress }: { onPress: () => void }) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Close"
      hitSlop={10}
      style={({ pressed }) => ({
        width: 34, height: 34, borderRadius: 17,
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: pressed ? c.surface.raised2 : c.surface.raised,
        borderWidth: 1, borderColor: c.border.hairline,
      })}
    >
      <Ionicons name="close" size={18} color={c.text.primary} />
    </Pressable>
  );
}

function AlertsStack() {
  const opts = useStackOptions();
  return (
    <Stack.Navigator screenOptions={opts}>
      <Stack.Screen
        name="Alerts"
        component={AlertsList}
        options={({ navigation }: any) => ({
          title: 'Notifications',
          // Opened from the bell on the home screen — give it a clear way out.
          headerLeft: () => <HeaderClose onPress={() => navigation.getParent()?.navigate('DevicesTab')} />,
        })}
      />
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
      <Stack.Screen name="Settings" component={SettingsScreen} options={{ headerShown: false }} />
      <Stack.Screen name="DevicesKeys" component={DevicesKeys} options={{ title: 'Devices & keys' }} />
      <Stack.Screen name="SecuritySettings" component={SecuritySettings} options={{ title: 'Security' }} />
      <Stack.Screen name="AppearanceSettings" component={AppearanceSettings} options={{ title: 'Appearance' }} />
      <Stack.Screen name="DataSettings" component={DataSettings} options={{ title: 'Data & retention' }} />
      <Stack.Screen name="SecurityLog" component={SecurityLog} options={{ title: 'Security log' }} />
      <Stack.Screen name="Diagnostics" component={Diagnostics} />
      <Stack.Screen name="AgentList" component={AgentList} options={{ title: 'Pis' }} />
      <Stack.Screen name="AgentDetail" component={AgentDetail} options={{ title: 'About this Pi' }} />
      <Stack.Screen name="AddRealPi" component={AddRealPi} options={{ headerShown: false, animation: 'slide_from_bottom' }} />
    </Stack.Navigator>
  );
}

// Floating pill tab bar in the Windows App style — a capsule bottom-left with the
// active tab highlighted, and Settings as its own circle on the right. Both are
// frosted glass. Notifications (Alerts) open from the bell on the Devices home.
const PILL_TABS: { name: string; icon: keyof typeof Ionicons.glyphMap; label: string }[] = [
  { name: 'DevicesTab', icon: 'desktop-outline', label: 'Devices' },
  { name: 'MonitorTab', icon: 'speedometer-outline', label: 'Monitor' },
];

const TAB_ROOTS: Record<string, string> = {
  DevicesTab: 'DevicesHome',
  MonitorTab: 'Dashboard',
  ControlTab: 'ControlHub',
  WidgetsTab: 'WidgetGallery',
  AlertsTab: 'Alerts',
  SettingsTab: 'Settings',
};

const glassEdge = { borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' } as const;

function PillTabBar({ state, navigation }: any) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const shellOpen = useStore((s) => s.shellSessionStartedAt != null);
  const activeRoute = state.routes[state.index];
  const activeName = activeRoute?.name;

  // The bar lives on the top-level surfaces only — pushed screens get the full height.
  const focusedScreen = getFocusedRouteNameFromRoute(activeRoute) ?? TAB_ROOTS[activeName];
  if (focusedScreen !== TAB_ROOTS[activeName] || activeName === 'AlertsTab') return null;

  return (
    <View
      pointerEvents="box-none"
      style={{ position: 'absolute', left: 16, right: 16, bottom: Math.max(insets.bottom, 12), flexDirection: 'row', alignItems: 'center' }}
    >
      <View style={{ flexDirection: 'row', borderRadius: 34, padding: 6, gap: 2, overflow: 'hidden', backgroundColor: 'rgba(28,28,31,0.35)', ...glassEdge }}>
        <BlurView intensity={50} tint="dark" style={StyleSheet.absoluteFill} />
        {PILL_TABS.map((tab) => {
          const active = activeName === tab.name;
          return (
            <Pressable
              key={tab.name}
              onPress={() => navigation.navigate(tab.name)}
              accessibilityRole="button"
              accessibilityLabel={tab.label}
              accessibilityState={{ selected: active }}
              style={{
                flexDirection: 'row', alignItems: 'center',
                paddingHorizontal: active ? 16 : 13, height: 52, borderRadius: 28,
                backgroundColor: active ? 'rgba(255,255,255,0.14)' : 'transparent',
              }}
            >
              <View>
                <Ionicons name={tab.icon} size={21} color={active ? c.accent.base : '#B4B4BA'} />
                {tab.name === 'ControlTab' && shellOpen && (
                  <View style={{ position: 'absolute', right: -3, top: -2, width: 7, height: 7, borderRadius: 4, backgroundColor: c.accent.base }} />
                )}
              </View>
              {active && (
                <Text style={{ color: c.accent.base, fontSize: 13, fontWeight: '600', marginLeft: 7 }}>{tab.label}</Text>
              )}
            </Pressable>
          );
        })}
      </View>

      <View style={{ flex: 1 }} />

      <Pressable onPress={() => navigation.navigate('SettingsTab')} accessibilityRole="button" accessibilityLabel="Settings">
        {({ pressed }) => (
          <View
            style={{
              width: 58, height: 58, borderRadius: 29, overflow: 'hidden', alignItems: 'center', justifyContent: 'center',
              backgroundColor: activeName === 'SettingsTab' || pressed ? 'rgba(255,255,255,0.16)' : 'rgba(28,28,31,0.35)', ...glassEdge,
            }}
          >
            <BlurView intensity={50} tint="dark" style={StyleSheet.absoluteFill} />
            <Ionicons name="settings-outline" size={22} color={activeName === 'SettingsTab' ? c.accent.base : '#EDEDF0'} />
          </View>
        )}
      </Pressable>
    </View>
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
      <Stack.Screen name="ConnectDevices" component={ConnectDevices} options={{ headerShown: false }} />
      <Stack.Screen name="ConnectLogin" component={ConnectLoginScreen} options={{ headerShown: false, animation: 'slide_from_bottom', gestureEnabled: false }} />
      <Stack.Screen name="AddRealPi" component={AddRealPi} options={{ headerShown: false, animation: 'slide_from_bottom' }} />
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

// Landscape is ONLY for a live desktop (GUI) session; every other screen —
// including the SSH terminal — is portrait. Decided in one place from the
// focused route, so no screen can leave the app stuck sideways.
function isGuiRoute(route: { name: string; params?: any } | undefined): boolean {
  if (!route) return false;
  if (route.name === 'RemoteSession') return true;
  return route.name === 'ConnectDevices' && !!route.params?.url && route.params?.mode !== 'ssh';
}
let lastLock: 'landscape' | 'portrait' | null = null;
function syncOrientation() {
  const want = isGuiRoute(navigationRef.isReady() ? navigationRef.getCurrentRoute() : undefined) ? 'landscape' : 'portrait';
  if (want === lastLock) return;
  lastLock = want;
  ScreenOrientation.lockAsync(
    want === 'landscape' ? ScreenOrientation.OrientationLock.LANDSCAPE : ScreenOrientation.OrientationLock.PORTRAIT_UP,
  ).catch(() => {});
}

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

/** Widget deep link: pimon://open?id=<device>&mode=gui|ssh → that device's
 *  desktop or terminal (once the account's devices are known). */
function useWidgetLinks() {
  useEffect(() => {
    const handle = (url: string | null) => {
      if (!url || !/^pimon:\/\/open\b/.test(url)) return;
      const q = url.split('?')[1] ?? '';
      const params = Object.fromEntries(q.split('&').filter(Boolean).map((kv) => kv.split('=').map(decodeURIComponent)));
      const tryOpen = (attempt = 0) => {
        const s = useStore.getState();
        const dev = s.connectDevices.find((d) => d.id === params.id);
        if (dev && s.connectStatus === 'signedIn' && navigationRef.isReady()) {
          navigationRef.navigate('DevicesTab', {
            screen: 'ConnectDevices',
            params: { url: dev.url, title: dev.name, mode: params.mode === 'ssh' ? 'ssh' : 'gui' },
          });
        } else if (attempt < 20) {
          setTimeout(() => tryOpen(attempt + 1), 500); // wait for the session check
        }
      };
      tryOpen();
    };
    Linking.getInitialURL().then(handle);
    const sub = Linking.addEventListener('url', ({ url }) => handle(url));
    return () => sub.remove();
  }, []);
}

export function RootNavigation() {
  const { c, isDark } = useTheme();
  const paired = useStore((s) => s.paired);
  const connectStatus = useStore((s) => s.connectStatus);
  const live = useStore(connectLive);
  const set = useStore((s) => s.set);
  useCaptureRunner();
  useWidgetLinks();

  // Don't wait forever on the background session check (e.g. offline).
  useEffect(() => {
    if (connectStatus !== 'checking') return;
    const t = setTimeout(() => {
      // Signed in last time: stay on the saved devices while offline — only a
      // real "please sign in" from Connect signs the user out.
      if (useStore.getState().connectSignedIn) return;
      if (useStore.getState().connectStatus === 'checking') {
        connectSignOutReason.quiet = true; // offline, not an expired session
        set({ connectStatus: 'signedOut' });
      }
    }, 15000);
    return () => clearTimeout(t);
  }, [connectStatus, set]);

  // Session expired → open the sign-in page again (Welcome does this itself when
  // the app falls back to onboarding; here we cover staying on the home tabs).
  const prevStatus = useRef(connectStatus);
  useEffect(() => {
    const prev = prevStatus.current;
    prevStatus.current = connectStatus;
    if (connectStatus !== 'signedOut' || prev === 'signedOut') return;
    if (connectSignOutReason.quiet) { connectSignOutReason.quiet = false; return; }
    if (!(useStore.getState().paired || CAPTURE_ENABLED)) return; // onboarding → Welcome opens it
    const t = setTimeout(() => {
      // Skip if the user signed back in (or out on purpose) in the meantime.
      if (useStore.getState().connectStatus !== 'signedOut') return;
      if (navigationRef.isReady()) navigationRef.navigate('DevicesTab', { screen: 'ConnectLogin' });
    }, 500);
    return () => clearTimeout(t);
  }, [connectStatus]);

  // A live Raspberry Pi Connect session goes straight to the home screen with the
  // account's devices; otherwise the welcome screen (which offers sign-in).
  // Signed in last time → open straight to home while the check runs.
  const showHome = paired || live || CAPTURE_ENABLED;

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

  // Brief splash while we find out whether the saved session is still valid.
  if (!showHome && connectStatus === 'checking') {
    return (
      <View style={{ flex: 1, backgroundColor: c.surface.canvas, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={c.accent.base} />
      </View>
    );
  }

  return (
    <NavigationContainer ref={navigationRef} theme={navTheme} onReady={syncOrientation} onStateChange={syncOrientation} linking={showHome && !CAPTURE_ENABLED ? linking : undefined}>
      {showHome ? <MainTabs /> : <OnboardingStack />}
    </NavigationContainer>
  );
}
