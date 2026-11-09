import { router } from 'expo-router';
import { Building2, ChevronRight, Plus } from 'lucide-react-native';
import { memo, useCallback, useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';

import { Avatar, Button, Card, EmptyState, IconButton, NavHeader, Screen, SearchBar, SegmentedControl, StatTile, Text } from '@/components/ui';
import { useBalances } from '@/hooks/useAccounts';
import { useCustomers, useJobs } from '@/hooks/useData';
import { useRefresh } from '@/hooks/useRefresh';
import { routes } from '@/navigation/routes';
import { colors, spacing } from '@/theme';
import type { BalanceTotals, CustomerBalance } from '@/services/accounts';
import type { Customer } from '@/types';
import { formatCurrency, searchKey } from '@/utils/format';

interface CustomerSummary {
  customer: Customer;
  jobCount: number;
  total: number;
  balance?: CustomerBalance;
}

type Mode = 'all' | 'balance';

const CustomerItem = memo(function CustomerItem({ item }: { item: CustomerSummary }) {
  const { customer, jobCount, total, balance } = item;
  const owed = balance?.balance ?? 0;
  return (
    <Card onPress={() => router.push(routes.customer(customer.id))} style={styles.item} accessibilityLabel={customer.companyName}>
      <Avatar name={customer.companyName} size={44} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="heading" numberOfLines={1}>{customer.companyName}</Text>
        <Text variant="bodySmall" tone="secondary" numberOfLines={1}>{customer.contactName || customer.email || 'İletişim bilgisi yok'}</Text>
        <Text variant="bodySmall" tone="tertiary">
          {jobCount} iş · {formatCurrency(total)}
        </Text>
      </View>
      {owed !== 0 ? (
        <View style={styles.balance}>
          <Text variant="caption" tone="tertiary">{owed > 0 ? 'Bakiye' : 'Alacaklı'}</Text>
          <Text variant="subheading" tone={owed > 0 ? 'danger' : 'default'}>{formatCurrency(Math.abs(owed))}</Text>
        </View>
      ) : null}
      <ChevronRight size={18} color={colors.textTertiary} />
    </Card>
  );
});

export default function CustomersScreen() {
  const customers = useCustomers();
  const jobs = useJobs();
  const balances = useBalances();
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<Mode>('all');
  const { refreshing, onRefresh: refreshStore } = useRefresh();
  const reloadBalances = balances.reload;
  const onRefresh = useCallback(() => {
    reloadBalances();
    refreshStore();
  }, [reloadBalances, refreshStore]);

  const data = useMemo<CustomerSummary[]>(() => {
    const stats = new Map<string, { count: number; total: number }>();
    for (const j of jobs) {
      if (j.status === 'cancelled') continue;
      const s = stats.get(j.customerId) ?? { count: 0, total: 0 };
      s.count++;
      s.total += j.price;
      stats.set(j.customerId, s);
    }
    const byCustomer = new Map((balances.data?.items ?? []).map((b) => [b.customerId, b]));
    const q = searchKey(query.trim());
    const rows = customers
      .filter((c) => !q || searchKey(`${c.companyName} ${c.contactName} ${c.email} ${c.taxNumber}`).includes(q))
      .map((c) => ({ customer: c, jobCount: stats.get(c.id)?.count ?? 0, total: stats.get(c.id)?.total ?? 0, balance: byCustomer.get(c.id) }));
    if (mode === 'all') return rows;
    // Bakiyesi olanlar, borcu en yüksek olan üstte.
    return rows.filter((r) => (r.balance?.balance ?? 0) !== 0).sort((a, b) => (b.balance?.balance ?? 0) - (a.balance?.balance ?? 0));
  }, [customers, jobs, query, balances.data, mode]);

  const renderItem = useCallback(({ item }: { item: CustomerSummary }) => <CustomerItem item={item} />, []);

  return (
    <Screen>
      <NavHeader title="Müşteriler" subtitle={`${customers.length} kayıtlı müşteri`} right={<IconButton icon={Plus} label="Yeni müşteri" tone="dark" onPress={() => router.push(routes.newCustomer)} />}>
        <SearchBar value={query} onChange={setQuery} placeholder="Firma, yetkili, e-posta, vergi no" dark />
        <SegmentedControl
          dark
          value={mode}
          onChange={setMode}
          options={[
            { value: 'all', label: 'Tümü' },
            { value: 'balance', label: 'Bakiyesi olanlar', count: balances.data?.totals.customersWithBalance },
          ]}
        />
      </NavHeader>
      <FlatList
        data={data}
        keyExtractor={(i) => i.customer.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={Separator}
        ListHeaderComponent={balances.data ? <BalanceSummary totals={balances.data.totals} /> : undefined}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.textTertiary} />}
        ListEmptyComponent={
          <EmptyState
            icon={Building2}
            title={query ? 'Eşleşen müşteri yok' : mode === 'balance' ? 'Açık bakiye yok' : 'Henüz müşteri yok'}
            description={
              query ? 'Farklı bir arama deneyin.' : mode === 'balance' ? 'Kesilen faturaların tamamı tahsil edilmiş.' : 'İş oluşturmak için önce müşteri ekleyin.'
            }
            action={<Button label="Müşteri ekle" icon={Plus} size="sm" onPress={() => router.push(routes.newCustomer)} />}
          />
        }
      />
    </Screen>
  );
}

/** Tüm müşterilerin toplam bakiyesi ve gelen/giden tutarlar. */
function BalanceSummary({ totals }: { totals: BalanceTotals }) {
  return (
    <View style={styles.summary}>
      <StatTile
        label="Toplam alacak"
        value={formatCurrency(totals.balance, { decimals: 2 })}
        hint={`${totals.customersWithBalance} müşteride açık bakiye`}
        emphasis
      />
      <View style={styles.summaryRow}>
        <StatTile label="Kesilen fatura" value={formatCurrency(totals.invoiced + totals.charged)} />
        <StatTile label="Gelen" value={formatCurrency(totals.collected)} />
        <StatTile label="Giden" value={formatCurrency(totals.refunded)} />
      </View>
    </View>
  );
}

const Separator = () => <View style={{ height: spacing.sm }} />;

const styles = StyleSheet.create({
  list: { padding: spacing.lg, paddingBottom: spacing.huge, flexGrow: 1 },
  item: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  balance: { alignItems: 'flex-end', gap: 2 },
  summary: { gap: spacing.sm, marginBottom: spacing.md },
  summaryRow: { flexDirection: 'row', gap: spacing.sm },
});
