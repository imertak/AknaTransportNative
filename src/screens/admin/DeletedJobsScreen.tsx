import { router } from 'expo-router';
import { Trash2 } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';

import { Card, EmptyState, ErrorState, LoadingState, MonthHeader, monthSeparator, NavHeader, Screen, SearchBar, StatusBadge, Text } from '@/components/ui';
import { routes } from '@/navigation/routes';
import { errorMessage } from '@/services/errors';
import { jobService } from '@/services/registry';
import { colors, spacing } from '@/theme';
import type { TransportJob } from '@/types';
import { formatDate, formatDateTime, partyLabel } from '@/utils/format';
import { groupByMonth, monthRowKey, type MonthRow } from '@/utils/monthGroups';

/** Yönetici: mantıksal olarak silinmiş işler. Standart listelerde görünmeyen işler burada incelenir ve geri alınır. */
export default function DeletedJobsScreen() {
  const [query, setQuery] = useState('');
  const [jobs, setJobs] = useState<TransportJob[]>();
  const [error, setError] = useState<string>();
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (search: string) => {
    try {
      setError(undefined);
      setJobs(await jobService.listDeleted(search));
    } catch (e) {
      setError(errorMessage(e, 'Silinen işler yüklenemedi.'));
    }
  }, []);

  // Arama yazılırken her tuşta istek atılmaz.
  useEffect(() => {
    const t = setTimeout(() => void load(query), query ? 350 : 0);
    return () => clearTimeout(t);
  }, [query, load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load(query);
    setRefreshing(false);
  }, [load, query]);

  // Liste silinme ayına göre bölünür.
  const rows = useMemo(() => (jobs ? groupByMonth(jobs, (j) => j.deletedAt ?? j.date, (j) => j.id) : []), [jobs]);

  const renderItem = useCallback(
    ({ item: row, index }: { item: MonthRow<TransportJob>; index: number }) => {
      if (row.kind === 'month') return <MonthHeader label={row.label} first={index === 0} summary={`${row.items.length} iş`} />;
      const item = row.item;
      return (
      <Card onPress={() => router.push(routes.deletedJob(item.id))} style={styles.card}>
        <View style={styles.top}>
          <Text variant="subheading">{item.jobNo}</Text>
          <StatusBadge status={item.status} />
        </View>
        <Text variant="bodySmall" tone="secondary" numberOfLines={1}>
          {partyLabel(item.customerName, item.storeName)} · {formatDate(item.date)}
        </Text>
        <View style={styles.meta}>
          <Trash2 size={14} color={colors.textTertiary} />
          <Text variant="bodySmall" tone="tertiary" style={{ flex: 1 }} numberOfLines={2}>
            {[item.deletedAt ? formatDateTime(item.deletedAt) : undefined, item.deletedByName, item.deletionReason].filter(Boolean).join(' · ')}
          </Text>
        </View>
      </Card>
      );
    },
    [],
  );

  return (
    <Screen>
      <NavHeader title="Silinen işler" subtitle={jobs ? `${jobs.length} kayıt` : undefined}>
        <SearchBar value={query} onChange={setQuery} placeholder="İş no, müşteri, mağaza, adres" dark />
      </NavHeader>
      {error && !jobs ? (
        <ErrorState message={error} onRetry={() => void load(query)} />
      ) : !jobs ? (
        <LoadingState label="Silinen işler yükleniyor" />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={monthRowKey}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={Separator}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.textTertiary} />}
          ListEmptyComponent={
            <EmptyState
              icon={Trash2}
              title={query ? 'Eşleşen silinmiş iş yok' : 'Silinmiş iş yok'}
              description="Silinen işler burada geçmişleriyle birlikte saklanır."
            />
          }
        />
      )}
    </Screen>
  );
}

const Separator = monthSeparator(spacing.md + 2);

const styles = StyleSheet.create({
  list: { padding: spacing.lg, paddingBottom: spacing.huge, flexGrow: 1 },
  card: { gap: spacing.xs },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  meta: { flexDirection: 'row', gap: spacing.xs + 2, alignItems: 'flex-start', marginTop: spacing.xs },
});
