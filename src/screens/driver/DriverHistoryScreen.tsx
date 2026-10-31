import { router } from 'expo-router';
import { History } from 'lucide-react-native';
import { useCallback, useMemo } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';

import { JobCard } from '@/components/jobs/JobCard';
import { EmptyState, PageHeader, Screen } from '@/components/ui';
import { can } from '@/constants/permissions';
import { useCurrentUser } from '@/contexts/AuthContext';
import { useDriverJobs } from '@/hooks/useData';
import { useRefresh } from '@/hooks/useRefresh';
import { routes } from '@/navigation/routes';
import { colors, spacing } from '@/theme';
import type { TransportJob } from '@/types';
import { formatCurrency } from '@/utils/format';

export default function DriverHistoryScreen() {
  const user = useCurrentUser();
  const { completed } = useDriverJobs(user.id);
  const { refreshing, onRefresh } = useRefresh();
  const showPrice = can(user, 'jobs.viewPrice');
  const data = useMemo(() => [...completed].sort((a, b) => b.date.localeCompare(a.date)), [completed]);
  const total = useMemo(() => completed.reduce((s, j) => s + j.price, 0), [completed]);

  const openJob = useCallback((job: TransportJob) => router.push(routes.job(job.id, 'driver')), []);
  const renderItem = useCallback(({ item }: { item: TransportJob }) => <JobCard job={item} onPress={openJob} showPrice={showPrice} />, [openJob, showPrice]);

  return (
    <Screen>
      <PageHeader title="Geçmiş" subtitle={`${completed.length} tamamlanan iş${showPrice ? ` · ${formatCurrency(total)}` : ''}`} />
      <FlatList
        data={data}
        keyExtractor={(j) => j.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={Separator}
        initialNumToRender={8}
        removeClippedSubviews
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.textTertiary} />}
        ListEmptyComponent={<EmptyState icon={History} title="Henüz tamamlanan iş yok" description="Tamamladığınız işler burada listelenir." />}
      />
    </Screen>
  );
}

const Separator = () => <View style={{ height: spacing.sm + 2 }} />;

const styles = StyleSheet.create({
  list: { padding: spacing.lg, paddingBottom: spacing.huge, flexGrow: 1 },
});
