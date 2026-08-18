// Bench type scale (docs/13-DESIGN-SYSTEM.md §3).
// SF Mono is not a public font family on iOS; Menlo is the closest system
// monospaced face. All numeric styles carry tabular-nums per the mandate.
import { Platform, TextStyle } from 'react-native';

export const mono = Platform.select({ ios: 'Menlo', default: 'monospace' })!;

const tab: TextStyle = { fontVariant: ['tabular-nums'] };

export const type = {
  hero: { fontFamily: mono, fontSize: 44, fontWeight: '500', lineHeight: 48, letterSpacing: -1.0, ...tab } as TextStyle,
  display: { fontSize: 34, fontWeight: '700', lineHeight: 40, letterSpacing: -0.6 } as TextStyle,
  title1: { fontSize: 28, fontWeight: '600', lineHeight: 34, letterSpacing: -0.4 } as TextStyle,
  title2: { fontSize: 22, fontWeight: '600', lineHeight: 28, letterSpacing: -0.3 } as TextStyle,
  title3: { fontSize: 20, fontWeight: '600', lineHeight: 25, letterSpacing: -0.2 } as TextStyle,
  metricXl: { fontFamily: mono, fontSize: 32, fontWeight: '500', lineHeight: 36, letterSpacing: -0.8, ...tab } as TextStyle,
  metricL: { fontFamily: mono, fontSize: 24, fontWeight: '500', lineHeight: 28, letterSpacing: -0.5, ...tab } as TextStyle,
  metricM: { fontFamily: mono, fontSize: 17, fontWeight: '500', lineHeight: 22, letterSpacing: -0.2, ...tab } as TextStyle,
  metricS: { fontFamily: mono, fontSize: 13, fontWeight: '400', lineHeight: 17, ...tab } as TextStyle,
  body: { fontSize: 17, fontWeight: '400', lineHeight: 22, ...tab } as TextStyle,
  bodyEmph: { fontSize: 17, fontWeight: '600', lineHeight: 22, ...tab } as TextStyle,
  callout: { fontSize: 16, fontWeight: '400', lineHeight: 21, ...tab } as TextStyle,
  subhead: { fontSize: 15, fontWeight: '400', lineHeight: 20, ...tab } as TextStyle,
  footnote: { fontSize: 13, fontWeight: '400', lineHeight: 18, ...tab } as TextStyle,
  caption: { fontSize: 12, fontWeight: '400', lineHeight: 16, letterSpacing: 0.1, ...tab } as TextStyle,
  micro: { fontSize: 11, fontWeight: '600', lineHeight: 14, letterSpacing: 0.6, textTransform: 'uppercase', ...tab } as TextStyle,
  monoBody: { fontFamily: mono, fontSize: 14, fontWeight: '400', lineHeight: 19, ...tab } as TextStyle,
  monoTerm: { fontFamily: mono, fontSize: 13, fontWeight: '400', lineHeight: 17, ...tab } as TextStyle,
};
