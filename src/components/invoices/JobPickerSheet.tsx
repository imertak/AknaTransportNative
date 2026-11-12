import { Check, Search, Square, SquareCheck } from 'lucide-react-native';
import { memo, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Button, Sheet, Text } from '@/components/ui';
import { colors, inputSelection, radius, spacing, typography } from '@/theme';
import type { TransportJob } from '@/types';
import { formatCurrency, formatDate, searchKey } from '@/utils/format';
import { composeJobText } from '@/utils/stops';

/** Müşteri adı bu uzunluktan sonra "…" ile kısaltılır; iş bilgileri satırda görünür kalsın. */
export const CUSTOMER_NAME_MAX = 22;

export function shortName(name: string, max = CUSTOMER_NAME_MAX) {
  const n = name.trim();
  return n.length > max ? `${n.slice(0, max - 1).trimEnd()}…` : n;
}

/** İşin tutarı: yeşil yuvarlak rozet (listede ilk göze çarpan bilgi). */
export const AmountBadge = memo(function AmountBadge({ amount }: { amount: number }) {
  return (
    <View style={styles.badge}>
      <Text variant="label" style={styles.badgeText} numberOfLines={1}>
        {formatCurrency(amount)}
      </Text>
    </View>
  );
});

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Listelenecek işler (aynı müşteri kuralı çağıran tarafta uygulanır). */
  jobs: TransportJob[];
  selectedIds: string[];
  onToggle: (id: string) => void;
}

/**
 * Faturalanacak işleri seçme perdesi. Bir işe dokunmak onu seçer veya seçimi kaldırır; perde açık kalır,
 * istenen kadar iş seçilip "Tamam" ile kapatılır.
 */
export function JobPickerSheet({ visible, onClose, jobs, selectedIds, onToggle }: Props) {
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    if (!query.trim()) return jobs;
    const q = searchKey(query);
    return jobs.filter((j) => searchKey(`${j.jobNo} ${j.customerName} ${j.storeName} ${j.routeDescription} ${j.description}`).includes(q));
  }, [jobs, query]);
  const selectedTotal = jobs.filter((j) => selectedIds.includes(j.id)).reduce((s, j) => s + j.price, 0);

  const close = () => {
    setQuery('');
    onClose();
  };

  return (
    <Sheet
      visible={visible}
      onClose={close}
      title="Faturalanacak işler"
      subtitle="Aynı müşteriye ait işleri birlikte seçebilirsiniz."
      footer={
        <Button
          label={selectedIds.length ? `Tamam · ${selectedIds.length} iş · ${formatCurrency(selectedTotal)}` : 'Kapat'}
          icon={selectedIds.length ? Check : undefined}
          onPress={close}
        />
      }>
      <View style={styles.search}>
        <Search size={18} color={colors.textTertiary} />
        <TextInput value={query} onChangeText={setQuery} placeholder="Ara" placeholderTextColor={colors.textTertiary} style={styles.searchInput} autoCorrect={false} {...inputSelection} />
      </View>
      <FlatList
        data={filtered}
        keyExtractor={(j) => j.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text tone="tertiary" style={styles.empty}>Faturalanacak iş bulunamadı.</Text>}
        renderItem={({ item: j }) => {
          const selected = selectedIds.includes(j.id);
          return (
            <Pressable
              onPress={() => onToggle(j.id)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={`${j.jobNo}, ${j.customerName}, ${formatCurrency(j.price)}`}
              style={({ pressed }) => [styles.option, selected && styles.optionSelected, pressed && { backgroundColor: colors.surfaceSunken }]}>
              {selected ? <SquareCheck size={22} color={colors.ink} /> : <Square size={22} color={colors.textTertiary} />}
              <AmountBadge amount={j.price} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text variant="subheading" numberOfLines={1}>
                  {j.jobNo} · {shortName(j.customerName)}
                </Text>
                <Text variant="bodySmall" tone="secondary" numberOfLines={2}>
                  {formatDate(j.date)} · {composeJobText(j.routeDescription, j.description)}
                </Text>
              </View>
            </Pressable>
          );
        }}
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
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
  badge: { backgroundColor: colors.success, borderRadius: 999, paddingHorizontal: spacing.md, paddingVertical: 6, minWidth: 64, alignItems: 'center' },
  badgeText: { color: colors.textInverse, fontVariant: ['tabular-nums'] },
});
