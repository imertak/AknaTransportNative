import { memo } from 'react';
import { Text as RNText, type TextProps } from 'react-native';

import { colors, typography, type TypographyVariant } from '@/theme';

type Tone = 'default' | 'secondary' | 'tertiary' | 'inverse' | 'inverseMuted' | 'danger';

const TONE: Record<Tone, string> = {
  default: colors.text,
  secondary: colors.textSecondary,
  tertiary: colors.textTertiary,
  inverse: colors.textInverse,
  inverseMuted: colors.textInverseMuted,
  danger: colors.danger,
};

export interface AppTextProps extends TextProps {
  variant?: TypographyVariant;
  tone?: Tone;
  align?: 'left' | 'center' | 'right';
}

export const Text = memo(function Text({ variant = 'body', tone = 'default', align, style, ...rest }: AppTextProps) {
  return <RNText {...rest} style={[typography[variant], { color: TONE[tone] }, align && { textAlign: align }, style]} />;
});
