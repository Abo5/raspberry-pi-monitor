import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as ScreenOrientation from 'expo-screen-orientation';
import { ThemeProvider, useTheme } from './src/theme';
import { RootNavigation } from './src/navigation';
import { ConnectSession } from './src/components/ConnectSession';
import { ConnectMonitor } from './src/components/ConnectMonitor';
import { useStore } from './src/store/useStore';
import { hydrate, startPersistence } from './src/store/persist';
import { startWidgetSync } from './src/net/widgetSync';

function Root() {
  const { isDark, c } = useTheme();
  const hydrated = useStore((s) => s.hydrated);

  useEffect(() => {
    hydrate().then(() => {
      startPersistence();
      startWidgetSync();
    });
    // Portrait everywhere by default; only the remote desktop unlocks landscape.
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
  }, []);

  if (!hydrated) return <View style={{ flex: 1, backgroundColor: c.surface.canvas }} />;

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <RootNavigation />
      {/* Hidden: checks the Raspberry Pi Connect session and reads the devices. */}
      <ConnectSession />
      {/* Hidden: live Monitor through Connect's remote shell (no SSH setup). */}
      <ConnectMonitor />
    </>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <Root />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
