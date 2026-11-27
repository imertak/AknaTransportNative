import { Platform, type TextStyle, type ViewStyle } from 'react-native';

/**
 * AKNA Transport tasarım sistemi.
 * Palet: kömür siyahı (#262626) koyu kartlar, açık gri (#EEEEEE) zemin ve beyaz yüzeyler. Ayrı bir vurgu
 * rengi yoktur: açık zeminde ana aksiyon koyu, koyu zeminde (giriş ekranı, koyu başlık, öne çıkan kutu)
 * beyazdır. Köşeler büyük ve yumuşak; butonlar ve ikon butonları hap/daire biçimindedir.
 * Hata/yıkıcı aksiyonlar kırmızıdır (danger).
 */
export const colors = {
  ink: '#262626',
  inkRaised: '#363636',
  inkLine: '#424242',
  inkMuted: '#9A9A9A',
  /** Siyah butonun basılı hali. */
  inkPressed: '#3A3A3A',

  background: '#EEEEEE',
  surface: '#FFFFFF',
  surfaceMuted: '#F6F6F6',
  surfaceSunken: '#EBEBEB',
  border: '#E6E6E6',
  borderStrong: '#D4D4D4',

  text: '#161616',
  textSecondary: '#5C5C5C',
  textTertiary: '#8E8E8E',
  textInverse: '#FFFFFF',
  textInverseMuted: '#A3A3A3',

  danger: '#D32F2F',
  dangerSoft: '#FFEBEE',
  dangerBorder: '#F2C4C4',

  /** Yalnızca "faturalandırıldı" işareti (yeşil fatura simgesi). */
  success: '#2E7D32',
  /** Hesaplanmış tutar kutularının açık yeşil zemini ve kenarı. */
  successSoft: '#E8F5E9',
  successBorder: '#C8E6C9',

  /** Koyu zemindeki vurgu: beyaz. Üzerindeki içerik onAccent (siyah). */
  accent: '#FFFFFF',
  accentSoft: '#EEEEEE',
  accentPressed: '#E6E6E6',
  onAccent: '#161616',

  /** Haritada gidilen hedef nokta. */
  destination: '#FFFFFF',
  destinationHalo: 'rgba(0, 0, 0, 0.18)',

  overlay: 'rgba(0, 0, 0, 0.5)',
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
  sm: 10,
  md: 16,
  lg: 24,
  xl: 32,
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
  ios: { shadowColor: colors.ink, shadowOpacity: 0.06, shadowRadius: 16, shadowOffset: { width: 0, height: 4 } },
  android: { elevation: 1 },
  default: {},
}) as ViewStyle;

/**
 * Metin kutularının imleç ve seçim renkleri. Android seçim zeminini selectionColor ile birebir boyar;
 * opak siyah verilirse seçilen yazı görünmez olur. Bu yüzden Android'de zemin yarı saydam, imleç ve
 * tutamaçlar opaktır. iOS seçim zeminine kendi saydamlığını uygular, orada opak renk verilir.
 */
export const inputSelection = {
  selectionColor: Platform.OS === 'ios' ? colors.ink : 'rgba(0, 0, 0, 0.18)',
  selectionHandleColor: colors.ink,
  cursorColor: colors.ink,
} as const;

/** Koyu zemindeki metin kutuları için (giriş ekranı, koyu arama). */
export const inputSelectionInverse = {
  selectionColor: Platform.OS === 'ios' ? colors.textInverse : 'rgba(255, 255, 255, 0.35)',
  selectionHandleColor: colors.textInverse,
  cursorColor: colors.textInverse,
} as const;

export const hitSlop = { top: 10, bottom: 10, left: 10, right: 10 };

export const theme = { colors, spacing, radius, typography, shadow };
export type Theme = typeof theme;
