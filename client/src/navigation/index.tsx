// Four tabs (§1.2): Dashboard · Control · Alerts · Settings. Agents are a
// context selector, not a navigation axis. Alerts tab badges unacknowledged
// count; Control shows a dot while a shell session runs.
import React, { useEffect } from 'react';
import * as Linking from 'expo-linking';
import { DarkTheme, DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';
import { useTheme } from '../theme';
import { useStore } from '../store/useStore';
import { startTunnel } from '../sim/tunnel';

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

function MainTabs() {
  const { c } = useTheme();
  const alerts = useStore((s) => s.alerts);
  const shellOpen = useStore((s) => s.shellSessionStartedAt != null);
  const unacked = alerts.filter((a) => a.resolvedAt == null && a.acknowledgedAt == null);
  const anyCritical = unacked.some((a) => a.severity === 'critical');

  useEffect(() => {
    // Re-establish the tunnel if the app reloaded while paired.
    if (useStore.getState().connection.kind === 'unknown') startTunnel();
  }, []);

  return (
    <Tabs.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.accent.base,
        tabBarInactiveTintColor: c.text.tertiary,
        tabBarStyle: { backgroundColor: c.surface.canvas, borderTopColor: c.border.hairline },
      }}
    >
      <Tabs.Screen
        name="DashboardTab"
        component={DashboardStack}
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, size }) => <Ionicons name="speedometer-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="ControlTab"
        component={ControlStack}
        options={{
          title: 'Control',
          tabBarIcon: ({ color, size }) => (
            <View>
              <Ionicons name="flash-outline" size={size} color={color} />
              {shellOpen && (
                <View
                  style={{
                    position: 'absolute',
                    right: -2,
                    top: -1,
                    width: 7,
                    height: 7,
                    borderRadius: 4,
                    backgroundColor: c.accent.base,
                  }}
                />
              )}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="AlertsTab"
        component={AlertsStack}
        options={{
          title: 'Alerts',
          tabBarIcon: ({ color, size }) => <Ionicons name="notifications-outline" size={size} color={color} />,
          tabBarBadge: unacked.length > 0 ? unacked.length : undefined,
          tabBarBadgeStyle: { backgroundColor: anyCritical ? c.status.critical : c.status.warning, color: '#fff' },
        }}
      />
      <Tabs.Screen
        name="SettingsTab"
        component={SettingsStack}
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => <Ionicons name="settings-outline" size={size} color={color} />,
        }}
      />
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
      DashboardTab: {
        screens: {
          Dashboard: 'dashboard',
          MetricDetail: 'metric/:seriesKey',
          AgentList: 'agents',
          AgentDetail: 'agent/:agentId',
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
