import { router, useLocalSearchParams } from 'expo-router';
import { ClipboardList, Plus, SlidersHorizontal } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { JobCard } from '@/components/jobs/JobCard';
import { JobFilterSheet, type AdvancedFilter } from '@/components/jobs/JobFilterSheet';
import { Button, Chip, EmptyState, IconButton, LoadingState, PageHeader, Screen, SearchBar, Text } from '@/components/ui';
import { IN_PROGRESS_STATUSES } from '@/constants/jobStatus';
import { useCustomers, useDataStatus, useFilteredJobs, useUserMap } from '@/hooks/useData';
import { useRefresh } from '@/hooks/useRefresh';
import { routes } from '@/navigation/routes';
import { colors, spacing } from '@/theme';
import type { JobFilter, JobStatus, TransportJob } from '@/types';
import { formatCurrency, formatDate } from '@/utils/format';

type StatusGroup = 'all' | 'pending' | 'assigned' | 'active' | 'completed' | 'cancelled';

const GROUPS: { value: StatusGroup; label: string; statuses?: JobStatus[] }[] = [
  { value: 'all', label: 'Tümü' },
  { value: 'pending', label: 'Bekleyen', statuses: ['pending'] },
  { value: 'assigned', label: 'Atanan', statuses: ['assigned'] },
  { value: 'active', label: 'Devam eden', statuses: IN_PROGRESS_STATUSES },
  { value: 'completed', label: 'Tamamlanan', statuses: ['completed'] },
  { value: 'cancelled', label: 'İptal', statuses: ['cancelled'] },
];

const isGroup = (v: unknown): v is StatusGroup => GROUPS.some((g) => g.value === v);

export default function JobsScreen() {
  const params = useLocalSearchParams<{ status?: string }>();
  const [group, setGroup] = useState<StatusGroup>(isGroup(params.status) ? params.status : 'all');
  const [query, setQuery] = useState('');
  const [advanced, setAdvanced] = useState<AdvancedFilter>({});
  const [filterOpen, setFilterOpen] = useState(false);
  const status = useDataStatus();
  const userMap = useUserMap();
  const customers = useCustomers();
  const { refreshing, onRefresh } = useRefresh();

  // Dashboard'dan gelen durum filtresi
  useEffect(() => {
    if (isGroup(params.status)) setGroup(params.status);
  }, [params.status]);

  const filter = useMemo<JobFilter>(
    () => ({ ...advanced, query: query.trim() || undefined, statuses: GROUPS.find((g) => g.value === group)?.statuses }),
    [advanced, query, group],
  );
  const jobs = useFilteredJobs(filter);
  const total = useMemo(() => jobs.reduce((s, j) => (j.status === 'cancelled' ? s : s + j.price), 0), [jobs]);

  const openJob = useCallback((job: TransportJob) => router.push(routes.job(job.id)), []);
  const renderItem = useCallback(
    ({ item }: { item: TransportJob }) => <JobCard job={item} onPress={openJob} showPrice driverName={item.driverId ? userMap.get(item.driverId)?.fullName ?? '—' : undefined} />,
    [openJob, userMap],
  );

  const activeChips: { key: keyof AdvancedFilter | 'date'; label: string }[] = [];
  if (advanced.customerId) activeChips.push({ key: 'customerId', label: customers.find((c) => c.id === advanced.customerId)?.companyName ?? 'Müşteri' });
  if (advanced.driverId) activeChips.push({ key: 'driverId', label: userMap.get(advanced.driverId)?.fullName ?? 'Şoför' });
  if (advanced.dateFrom || advanced.dateTo)
    activeChips.push({ key: 'date', label: `${advanced.dateFrom ? formatDate(advanced.dateFrom) : '…'} – ${advanced.dateTo ? formatDate(advanced.dateTo) : '…'}` });
  const advancedCount = activeChips.length;

  return (
    <Screen>
      <PageHeader title="İşler" subtitle={`${jobs.length} kayıt · ${formatCurrency(total)}`} right={<IconButton icon={Plus} label="Yeni iş" tone="dark" onPress={() => router.push(routes.newJob())} />}>
        <View style={styles.searchRow}>
          <View style={{ flex: 1 }}>
            <SearchBar value={query} onChange={setQuery} placeholder="İş no, müşteri, adres, şoför" dark />
          </View>
          <IconButton icon={SlidersHorizontal} label={`Filtreler${advancedCount ? ` (${advancedCount})` : ''}`} tone="dark" size={46} onPress={() => setFilterOpen(true)} />
        </View>
      </PageHeader>

      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {GROUPS.map((g) => (
            <Chip key={g.value} label={g.label} active={group === g.value} onPress={() => setGroup(g.value)} />
          ))}
        </ScrollView>
        {advancedCount ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.chips, { paddingTop: 0 }]}>
            {activeChips.map((c) => (
              <Chip
                key={c.key}
                label={c.label}
                onPress={() => setFilterOpen(true)}
                onClear={() => setAdvanced((a) => (c.key === 'date' ? { ...a, dateFrom: undefined, dateTo: undefined } : { ...a, [c.key]: undefined }))}
              />
            ))}
          </ScrollView>
        ) : null}
      </View>

      {status === 'loading' ? (
        <LoadingState label="İşler yükleniyor" />
      ) : (
        <FlatList
          data={jobs}
          keyExtractor={(j) => j.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={Separator}
          initialNumToRender={8}
          windowSize={7}
          removeClippedSubviews
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.textTertiary} />}
          ListEmptyComponent={
            <EmptyState
              icon={ClipboardList}
              title={query || advancedCount || group !== 'all' ? 'Eşleşen iş bulunamadı' : 'Henüz iş yok'}
              description={query || advancedCount || group !== 'all' ? 'Arama veya filtreleri değiştirmeyi deneyin.' : 'İlk nakliye işini oluşturarak başlayın.'}
              action={<Button label="Yeni iş oluştur" icon={Plus} size="sm" onPress={() => router.push(routes.newJob())} />}
            />
          }
          ListFooterComponent={jobs.length ? <Text variant="bodySmall" tone="tertiary" align="center" style={{ marginTop: spacing.lg }}>{jobs.length} iş listelendi</Text> : undefined}
        />
      )}

      <JobFilterSheet
        visible={filterOpen}
        value={advanced}
        onClose={() => setFilterOpen(false)}
        onApply={(f) => {
          setAdvanced(f);
          setFilterOpen(false);
        }}
      />
    </Screen>
  );
}

const Separator = () => <View style={{ height: spacing.sm + 2 }} />;

const styles = StyleSheet.create({
  searchRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  chips: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: spacing.sm },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.huge, flexGrow: 1 },
});
