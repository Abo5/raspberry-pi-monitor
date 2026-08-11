import React, { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { ColorTokens, dark, light, withAlpha } from './colors';
import { type } from './typography';
import { space, radius, motion } from './layout';
import { useStore } from '../store/useStore';

export interface Theme {
  c: ColorTokens;
  isDark: boolean;
  type: typeof type;
  space: typeof space;
  radius: typeof radius;
  motion: typeof motion;
  wash: (hex: string, alpha: number) => string;
}

const ThemeContext = createContext<Theme | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const pref = useStore((s) => s.settings.theme);
  const isDark = pref === 'dark' || (pref === 'system' && system !== 'light');
  const value = useMemo<Theme>(
    () => ({
      c: isDark ? dark : light,
      isDark,
      type,
      space,
      radius,
      motion,
      wash: withAlpha,
    }),
    [isDark],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const t = useContext(ThemeContext);
  if (!t) throw new Error('useTheme outside ThemeProvider');
  return t;
}

export { withAlpha } from './colors';
