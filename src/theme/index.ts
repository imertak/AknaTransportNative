import { Platform, type TextStyle, type ViewStyle } from 'react-native';

/**
 * AKNA Transport tasarım sistemi.
 * Siyah, beyaz ve gri tonlarından oluşan sade bir palet. Tek işlevsel renk
 * hata/yıkıcı aksiyonlar için kullanılan koyu kırmızıdır.
 */
export const colors = {
  ink: '#0B0B0C',
  inkRaised: '#161618',
  inkLine: '#2A2A2D',
  inkMuted: '#8E8E93',

  background: '#F2F2F0',
  surface: '#FFFFFF',
  surfaceMuted: '#F7F7F6',
  surfaceSunken: '#EBEBE9',
  border: '#E3E3E0',
  borderStrong: '#CFCFCC',

  text: '#0B0B0C',
  textSecondary: '#55555A',
  textTertiary: '#8A8A8F',
  textInverse: '#FFFFFF',
  textInverseMuted: '#A1A1A6',

  danger: '#A8261B',
  dangerSoft: '#FBEDEB',

  overlay: 'rgba(11, 11, 12, 0.45)',
} as const;

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 48,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
  pill: 999,
} as const;

const fontFamily = Platform.select({ ios: 'System', android: 'sans-serif', default: undefined });
const fontFamilyMedium = Platform.select({ android: 'sans-serif-medium', default: fontFamily });

export const typography = {
  display: { fontFamily, fontSize: 32, lineHeight: 38, fontWeight: '700', letterSpacing: -0.8 },
  title: { fontFamily, fontSize: 24, lineHeight: 30, fontWeight: '700', letterSpacing: -0.5 },
  heading: { fontFamily: fontFamilyMedium, fontSize: 17, lineHeight: 22, fontWeight: '600', letterSpacing: -0.2 },
  subheading: { fontFamily: fontFamilyMedium, fontSize: 15, lineHeight: 20, fontWeight: '600', letterSpacing: -0.1 },
  body: { fontFamily, fontSize: 15, lineHeight: 21, fontWeight: '400' },
  bodySmall: { fontFamily, fontSize: 13, lineHeight: 18, fontWeight: '400' },
  label: { fontFamily: fontFamilyMedium, fontSize: 13, lineHeight: 17, fontWeight: '500' },
  caption: { fontFamily: fontFamilyMedium, fontSize: 11, lineHeight: 14, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase' },
  number: { fontFamily, fontSize: 28, lineHeight: 32, fontWeight: '700', letterSpacing: -0.6, fontVariant: ['tabular-nums'] },
} satisfies Record<string, TextStyle>;

export type TypographyVariant = keyof typeof typography;

export const shadow: ViewStyle = Platform.select({
  ios: { shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  android: { elevation: 1 },
  default: {},
}) as ViewStyle;

export const hitSlop = { top: 10, bottom: 10, left: 10, right: 10 };

export const theme = { colors, spacing, radius, typography, shadow };
export type Theme = typeof theme;
