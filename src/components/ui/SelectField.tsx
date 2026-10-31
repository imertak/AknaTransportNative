import { Check, ChevronDown, Search } from 'lucide-react-native';
import { memo, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { colors, radius, spacing, typography } from '@/theme';
import { searchKey } from '@/utils/format';
import { FieldShell } from './Field';
import { Sheet } from './Sheet';
import { Text } from './Text';

export interface SelectOption<T extends string = string> {
  value: T;
  label: string;
  description?: string;
}

interface OptionSheetProps<T extends string> {
  visible: boolean;
  onClose: () => void;
  title: string;
  options: SelectOption<T>[];
  value?: T | null;
  onSelect: (value: T) => void;
  searchable?: boolean;
  emptyText?: string;
}

export function OptionSheet<T extends string>({ visible, onClose, title, options, value, onSelect, searchable, emptyText = 'Seçenek bulunamadı.' }: OptionSheetProps<T>) {
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    if (!query.trim()) return options;
    const q = searchKey(query);
    return options.filter((o) => searchKey(`${o.label} ${o.description ?? ''}`).includes(q));
  }, [options, query]);

  return (
    <Sheet visible={visible} onClose={onClose} title={title}>
      {searchable ? (
        <View style={styles.search}>
          <Search size={18} color={colors.textTertiary} />
          <TextInput value={query} onChangeText={setQuery} placeholder="Ara" placeholderTextColor={colors.textTertiary} style={styles.searchInput} autoCorrect={false} />
        </View>
      ) : null}
      <FlatList
        data={filtered}
        keyExtractor={(o) => o.value}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text tone="tertiary" style={styles.empty}>{emptyText}</Text>}
        renderItem={({ item }) => {
          const selected = item.value === value;
          return (
            <Pressable
              onPress={() => {
                onSelect(item.value);
                setQuery('');
                onClose();
              }}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              style={({ pressed }) => [styles.option, selected && styles.optionSelected, pressed && { backgroundColor: colors.surfaceSunken }]}>
              <View style={{ flex: 1 }}>
                <Text variant="subheading">{item.label}</Text>
                {item.description ? <Text variant="bodySmall" tone="secondary" numberOfLines={1}>{item.description}</Text> : null}
              </View>
              {selected ? <Check size={20} color={colors.text} strokeWidth={2.2} /> : null}
            </Pressable>
          );
        }}
      />
    </Sheet>
  );
}

interface SelectFieldProps<T extends string> {
  label: string;
  placeholder?: string;
  options: SelectOption<T>[];
  value?: T | null;
  onChange: (value: T) => void;
  error?: string;
  hint?: string;
  required?: boolean;
  searchable?: boolean;
  sheetTitle?: string;
}

function SelectFieldInner<T extends string>({ label, placeholder = 'Seçin', options, value, onChange, error, hint, required, searchable, sheetTitle }: SelectFieldProps<T>) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);
  return (
    <FieldShell label={label} error={error} hint={hint} required={required}>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${selected?.label ?? placeholder}`}
        style={({ pressed }) => [styles.box, !!error && styles.errorBox, pressed && { backgroundColor: colors.surfaceMuted }]}>
        <Text style={{ flex: 1 }} tone={selected ? 'default' : 'tertiary'} numberOfLines={1}>
          {selected?.label ?? placeholder}
        </Text>
        <ChevronDown size={18} color={colors.textTertiary} />
      </Pressable>
      <OptionSheet visible={open} onClose={() => setOpen(false)} title={sheetTitle ?? label} options={options} value={value} onSelect={onChange} searchable={searchable} />
    </FieldShell>
  );
}

export const SelectField = memo(SelectFieldInner) as typeof SelectFieldInner;

const styles = StyleSheet.create({
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
  errorBox: { borderColor: colors.danger },
  search: {
    marginHorizontal: spacing.xl,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: { flex: 1, ...typography.body, color: colors.text, paddingVertical: 10 },
  list: { paddingHorizontal: spacing.md, paddingBottom: spacing.md },
  option: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.md, borderRadius: radius.md, gap: spacing.md },
  optionSelected: { backgroundColor: colors.surfaceMuted },
  empty: { textAlign: 'center', padding: spacing.xl },
});
