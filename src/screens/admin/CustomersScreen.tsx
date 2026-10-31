import { router } from 'expo-router';
import { Building2, ChevronRight, Plus } from 'lucide-react-native';
import { memo, useCallback, useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';

import { Avatar, Button, Card, EmptyState, IconButton, NavHeader, Screen, SearchBar, Text } from '@/components/ui';
import { useCustomers, useJobs } from '@/hooks/useData';
import { useRefresh } from '@/hooks/useRefresh';
import { routes } from '@/navigation/routes';
import { colors, spacing } from '@/theme';
import type { Customer } from '@/types';
import { formatCurrency, searchKey } from '@/utils/format';

interface CustomerSummary {
  customer: Customer;
  jobCount: number;
  total: number;
}

const CustomerItem = memo(function CustomerItem({ item }: { item: CustomerSummary }) {
  const { customer, jobCount, total } = item;
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
      <ChevronRight size={18} color={colors.textTertiary} />
    </Card>
  );
});

export default function CustomersScreen() {
  const customers = useCustomers();
  const jobs = useJobs();
  const [query, setQuery] = useState('');
  const { refreshing, onRefresh } = useRefresh();

  const data = useMemo<CustomerSummary[]>(() => {
    const stats = new Map<string, { count: number; total: number }>();
    for (const j of jobs) {
      if (j.status === 'cancelled') continue;
      const s = stats.get(j.customerId) ?? { count: 0, total: 0 };
      s.count++;
      s.total += j.price;
      stats.set(j.customerId, s);
    }
    const q = searchKey(query.trim());
    return customers
      .filter((c) => !q || searchKey(`${c.companyName} ${c.contactName} ${c.email} ${c.taxNumber}`).includes(q))
      .map((c) => ({ customer: c, jobCount: stats.get(c.id)?.count ?? 0, total: stats.get(c.id)?.total ?? 0 }));
  }, [customers, jobs, query]);

  const renderItem = useCallback(({ item }: { item: CustomerSummary }) => <CustomerItem item={item} />, []);

  return (
    <Screen>
      <NavHeader title="Müşteriler" subtitle={`${customers.length} kayıtlı müşteri`} right={<IconButton icon={Plus} label="Yeni müşteri" tone="dark" onPress={() => router.push(routes.newCustomer)} />}>
        <SearchBar value={query} onChange={setQuery} placeholder="Firma, yetkili, e-posta, vergi no" dark />
      </NavHeader>
      <FlatList
        data={data}
        keyExtractor={(i) => i.customer.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={Separator}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.textTertiary} />}
        ListEmptyComponent={
          <EmptyState
            icon={Building2}
            title={query ? 'Eşleşen müşteri yok' : 'Henüz müşteri yok'}
            description={query ? 'Farklı bir arama deneyin.' : 'İş oluşturmak için önce müşteri ekleyin.'}
            action={<Button label="Müşteri ekle" icon={Plus} size="sm" onPress={() => router.push(routes.newCustomer)} />}
          />
        }
      />
    </Screen>
  );
}

const Separator = () => <View style={{ height: spacing.sm }} />;

const styles = StyleSheet.create({
  list: { padding: spacing.lg, paddingBottom: spacing.huge, flexGrow: 1 },
  item: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
});
