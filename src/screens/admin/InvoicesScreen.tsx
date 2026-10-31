import { router } from 'expo-router';
import { Plus, ReceiptText } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { InvoiceRow } from '@/components/invoices/InvoiceRow';
import { Button, EmptyState, IconButton, NavHeader, Screen, SegmentedControl } from '@/components/ui';
import { useInvoices } from '@/hooks/useData';
import { routes } from '@/navigation/routes';
import { colors, radius, spacing } from '@/theme';
import type { Invoice } from '@/types';
import { formatCurrency } from '@/utils/format';

type Tab = 'all' | 'active' | 'cancelled';

export default function InvoicesScreen() {
  const invoices = useInvoices();
  const [tab, setTab] = useState<Tab>('active');
  const data = useMemo(() => invoices.filter((i) => (tab === 'all' ? true : tab === 'cancelled' ? i.status === 'cancelled' : i.status !== 'cancelled')), [invoices, tab]);
  const total = useMemo(() => data.filter((i) => i.status !== 'cancelled').reduce((s, i) => s + i.total, 0), [data]);
  const open = useCallback((inv: Invoice) => router.push(routes.invoice(inv.id)), []);

  return (
    <Screen>
      <NavHeader title="Faturalar" subtitle={`${data.length} fatura · ${formatCurrency(total, { decimals: 2 })}`} right={<IconButton icon={Plus} label="Fatura oluştur" tone="dark" onPress={() => router.push(routes.newInvoice())} />}>
        <SegmentedControl
          dark
          value={tab}
          onChange={setTab}
          options={[
            { value: 'active', label: 'Geçerli' },
            { value: 'cancelled', label: 'İptal' },
            { value: 'all', label: 'Tümü' },
          ]}
        />
      </NavHeader>
      <FlatList
        data={data}
        keyExtractor={(i) => i.id}
        contentContainerStyle={styles.list}
        renderItem={({ item, index }) => (
          <View style={[styles.item, index === 0 && styles.first, index === data.length - 1 && styles.last]}>
            <InvoiceRow invoice={item} onPress={open} showCustomer last={index === data.length - 1} />
          </View>
        )}
        ListEmptyComponent={
          <EmptyState icon={ReceiptText} title="Fatura yok" description="Tamamlanan işler için demo fatura oluşturabilirsiniz." action={<Button label="Fatura oluştur" size="sm" icon={Plus} onPress={() => router.push(routes.newInvoice())} />} />
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.lg, paddingBottom: spacing.huge, flexGrow: 1 },
  item: { backgroundColor: colors.surface, borderLeftWidth: 1, borderRightWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  first: { borderTopWidth: 1, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg },
  last: { borderBottomWidth: 1, borderBottomLeftRadius: radius.lg, borderBottomRightRadius: radius.lg },
});
