import { router } from 'expo-router';
import { ClipboardList } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet } from 'react-native';

import { JobCard } from '@/components/jobs/JobCard';
import { EmptyState, MonthHeader, monthSeparator, PageHeader, Screen, SegmentedControl } from '@/components/ui';
import { isInProgress } from '@/constants/jobStatus';
import { can } from '@/constants/permissions';
import { useCurrentUser } from '@/contexts/AuthContext';
import { useDriverJobs } from '@/hooks/useData';
import { useRefresh } from '@/hooks/useRefresh';
import { routes } from '@/navigation/routes';
import { colors, spacing } from '@/theme';
import { groupByMonth, monthRowKey, type MonthRow } from '@/utils/monthGroups';
import type { TransportJob } from '@/types';

type Tab = 'open' | 'active' | 'waiting';

export default function DriverJobsScreen() {
  const user = useCurrentUser();
  const { open, waiting } = useDriverJobs(user.id);
  const [tab, setTab] = useState<Tab>('open');
  const { refreshing, onRefresh } = useRefresh();
  const showPrice = can(user, 'jobs.viewPrice');

  const activeList = useMemo(() => open.filter((j) => isInProgress(j.status)), [open]);
  const data = tab === 'open' ? open : tab === 'active' ? activeList : waiting;
  const rows = useMemo(() => groupByMonth(data, (j) => j.date, (j) => j.id), [data]);

  const openJob = useCallback((job: TransportJob) => router.push(routes.job(job.id, 'driver')), []);
  const renderItem = useCallback(
    ({ item, index }: { item: MonthRow<TransportJob>; index: number }) =>
      item.kind === 'month' ? (
        <MonthHeader label={item.label} first={index === 0} summary={`${item.items.length} iş`} />
      ) : (
        <JobCard job={item.item} onPress={openJob} showPrice={showPrice} />
      ),
    [openJob, showPrice],
  );

  return (
    <Screen>
      <PageHeader title="İşlerim" subtitle="Size atanmış ve devam eden işler">
        <SegmentedControl
          dark
          value={tab}
          onChange={setTab}
          options={[
            { value: 'open', label: 'Tümü', count: open.length },
            { value: 'active', label: 'Devam eden', count: activeList.length },
            { value: 'waiting', label: 'Bekleyen', count: waiting.length },
          ]}
        />
      </PageHeader>
      <FlatList
        data={rows}
        keyExtractor={monthRowKey}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={Separator}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.textTertiary} />}
        ListEmptyComponent={<EmptyState icon={ClipboardList} title="Bu listede iş yok" description="Yeni atanan işler burada görünür." />}
      />
    </Screen>
  );
}

const Separator = monthSeparator(spacing.sm + 2);

const styles = StyleSheet.create({
  list: { padding: spacing.lg, paddingBottom: spacing.huge, flexGrow: 1 },
});
