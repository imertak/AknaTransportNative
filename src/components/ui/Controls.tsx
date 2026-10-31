import { Search, X } from 'lucide-react-native';
import { memo } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { colors, hitSlop, radius, spacing, typography } from '@/theme';
import { initials } from '@/utils/format';
import { Text } from './Text';

interface SegmentedProps<T extends string> {
  options: { value: T; label: string; count?: number }[];
  value: T;
  onChange: (v: T) => void;
  dark?: boolean;
}

export function SegmentedControl<T extends string>({ options, value, onChange, dark }: SegmentedProps<T>) {
  return (
    <View style={[styles.segment, dark && styles.segmentDark]} accessibilityRole="tablist">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={[styles.segmentItem, active && (dark ? styles.segmentActiveDark : styles.segmentActive)]}>
            <Text variant="label" numberOfLines={1} tone={dark ? (active ? 'default' : 'inverseMuted') : active ? 'default' : 'secondary'}>
              {o.label}
              {o.count !== undefined ? ` · ${o.count}` : ''}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export const Chip = memo(function Chip({ label, active, onPress, onClear }: { label: string; active?: boolean; onPress?: () => void; onClear?: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
      style={({ pressed }) => [styles.chip, active && styles.chipActive, pressed && { opacity: 0.8 }]}>
      <Text variant="label" tone={active ? 'inverse' : 'default'}>
        {label}
      </Text>
      {onClear ? (
        <Pressable onPress={onClear} hitSlop={hitSlop} accessibilityLabel={`${label} filtresini kaldır`}>
          <X size={14} color={active ? colors.textInverse : colors.textSecondary} />
        </Pressable>
      ) : null}
    </Pressable>
  );
});

export const SearchBar = memo(function SearchBar({ value, onChange, placeholder = 'Ara', dark }: { value: string; onChange: (v: string) => void; placeholder?: string; dark?: boolean }) {
  return (
    <View style={[styles.search, dark && styles.searchDark]}>
      <Search size={18} color={dark ? colors.textInverseMuted : colors.textTertiary} />
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={dark ? colors.inkMuted : colors.textTertiary}
        style={[styles.searchInput, dark && { color: colors.textInverse }]}
        selectionColor={dark ? colors.textInverse : colors.ink}
        autoCorrect={false}
        returnKeyType="search"
        accessibilityLabel={placeholder}
      />
      {value ? (
        <Pressable onPress={() => onChange('')} hitSlop={hitSlop} accessibilityLabel="Aramayı temizle">
          <X size={16} color={dark ? colors.textInverseMuted : colors.textTertiary} />
        </Pressable>
      ) : null}
    </View>
  );
});

export const Avatar = memo(function Avatar({ name, size = 40, dark }: { name: string; size?: number; dark?: boolean }) {
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }, dark && styles.avatarDark]}>
      <Text variant="label" tone={dark ? 'inverse' : 'default'} style={{ fontSize: size * 0.36 }}>
        {initials(name)}
      </Text>
    </View>
  );
});

const styles = StyleSheet.create({
  segment: { flexDirection: 'row', backgroundColor: colors.surfaceSunken, borderRadius: radius.md, padding: 3 },
  segmentDark: { backgroundColor: colors.inkRaised, borderWidth: 1, borderColor: colors.inkLine },
  segmentItem: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 8, borderRadius: radius.sm + 1, paddingHorizontal: spacing.xs },
  segmentActive: { backgroundColor: colors.surface, shadowColor: colors.ink, shadowOpacity: 0.06, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  segmentActiveDark: { backgroundColor: colors.surface },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 34,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    height: 46,
    paddingHorizontal: spacing.md + 2,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchDark: { backgroundColor: colors.inkRaised, borderColor: colors.inkLine },
  searchInput: { flex: 1, ...typography.body, color: colors.text, paddingVertical: 0 },
  avatar: { backgroundColor: colors.surfaceSunken, alignItems: 'center', justifyContent: 'center' },
  avatarDark: { backgroundColor: colors.inkRaised, borderWidth: 1, borderColor: colors.inkLine },
});
