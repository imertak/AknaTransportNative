import type { LucideIcon } from 'lucide-react-native';
import { memo, useState, type ComponentRef, type ReactNode, type Ref } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { colors, inputSelection, radius, spacing, typography } from '@/theme';
import { InfoTip } from './InfoTip';
import { Text } from './Text';

export function FieldShell({ label, error, hint, required, children }: { label?: string; error?: string; hint?: string; required?: boolean; children: ReactNode }) {
  return (
    <View style={styles.field}>
      {label || hint ? (
        <View style={styles.labelRow}>
          {label ? (
            <Text variant="label" tone="secondary" style={{ flexShrink: 1 }}>
              {label}
              {required ? <Text variant="label" tone="tertiary"> *</Text> : null}
            </Text>
          ) : null}
          {/* Açıklama alanın altında sürekli durmaz; "i" ikonuna dokununca açılır. */}
          {hint ? <InfoTip text={hint} label={label ? `${label} hakkında` : 'Açıklama'} size={14} /> : null}
        </View>
      ) : null}
      {children}
      {error ? (
        <Text variant="bodySmall" tone="danger" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

export interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  icon?: LucideIcon;
  suffix?: string;
  right?: ReactNode;
  ref?: Ref<ComponentRef<typeof TextInput>>;
}

export const Input = memo(
  function Input({ label, error, hint, required, icon: Icon, suffix, right, style, multiline, onFocus, onBlur, ref, ...rest }: InputProps) {
    const [focused, setFocused] = useState(false);
    return (
      <FieldShell label={label} error={error} hint={hint} required={required}>
        <View style={[styles.box, multiline && styles.multiline, focused && styles.focused, !!error && styles.errorBox]}>
          {Icon ? <Icon size={18} color={colors.textTertiary} strokeWidth={2} /> : null}
          <TextInput
            ref={ref}
            placeholderTextColor={colors.textTertiary}
            {...inputSelection}
            multiline={multiline}
            accessibilityLabel={label}
            onFocus={(e) => {
              setFocused(true);
              onFocus?.(e);
            }}
            onBlur={(e) => {
              setFocused(false);
              onBlur?.(e);
            }}
            style={[styles.input, multiline && styles.inputMultiline, style]}
            {...rest}
          />
          {suffix ? <Text variant="label" tone="tertiary">{suffix}</Text> : null}
          {right}
        </View>
      </FieldShell>
    );
  },
);

const styles = StyleSheet.create({
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  field: { gap: spacing.xs + 2 },
  box: {
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md + 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  multiline: { alignItems: 'flex-start', paddingVertical: spacing.sm },
  focused: { borderColor: colors.ink },
  errorBox: { borderColor: colors.danger },
  input: { flex: 1, ...typography.body, color: colors.text, paddingVertical: 12 },
  inputMultiline: { minHeight: 84, textAlignVertical: 'top', paddingVertical: 4 },
});
