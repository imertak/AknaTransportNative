import { router, type Href } from 'expo-router';
import { Building2, FileText, Plus, Truck } from 'lucide-react-native';
import { useMemo } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { JobRow } from '@/components/jobs/JobRow';
import { Avatar, Badge, Button, Card, EmptyState, IconButton, PageHeader, Screen, Section, StatTile, Text } from '@/components/ui';
import { JOB_STATUS_LABEL, isInProgress } from '@/constants/jobStatus';
import { useCurrentUser } from '@/contexts/AuthContext';
import { useDashboardStats, useJobs, useLocations, useUsers, useVehicles } from '@/hooks/useData';
import { useRefresh } from '@/hooks/useRefresh';
import { routes } from '@/navigation/routes';
import { colors, spacing } from '@/theme';
import type { JobStatus, TransportJob } from '@/types';
import { formatCurrency, formatDateLong, formatRelative, todayISO } from '@/utils/format';

const openJob = (job: TransportJob) => router.push(routes.job(job.id));
const jobsWith = (status: string): Href => ({ pathname: '/admin/jobs', params: { status } }) as Href;

export default function DashboardScreen() {
  const user = useCurrentUser();
  const stats = useDashboardStats();
  const jobs = useJobs();
  const users = useUsers();
  const vehicles = useVehicles();
  const locations = useLocations();
  const { refreshing, onRefresh } = useRefresh();

  const recentCreated = useMemo(() => [...jobs].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 4), [jobs]);
  const recentCompleted = useMemo(
    () => jobs.filter((j) => j.status === 'completed').sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 4),
    [jobs],
  );

  const activeDrivers = useMemo(() => {
    const out: { userId: string; name: string; plate?: string; job: TransportJob }[] = [];
    for (const u of users) {
      const job = jobs.find((j) => j.driverId === u.id && isInProgress(j.status));
      if (job) out.push({ userId: u.id, name: u.fullName, plate: vehicles.find((v) => v.id === u.vehicleId)?.plate, job });
    }
    return out;
  }, [users, jobs, vehicles]);

  const firstName = user.fullName.split(' ')[0];

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.textInverseMuted} />}>
        <PageHeader
          overline={formatDateLong(todayISO())}
          title={`Merhaba, ${firstName}`}
          right={<IconButton icon={Plus} label="Yeni iş oluştur" tone="dark" onPress={() => router.push(routes.newJob())} />}>
          <View style={styles.revenue}>
            <Text variant="bodySmall" tone="inverseMuted">Toplam nakliye geliri</Text>
            <Text variant="display" tone="inverse" style={styles.tabular}>{formatCurrency(stats.revenue)}</Text>
            <Text variant="bodySmall" tone="inverseMuted">
              {stats.completed} tamamlanan iş · Açık işler {formatCurrency(stats.openValue)}
            </Text>
          </View>
        </PageHeader>

        <View style={styles.body}>
          <View style={styles.grid}>
            <StatTile label="Toplam iş" value={stats.total} emphasis onPress={() => router.navigate(routes.adminJobs)} />
            <StatTile label="Bekleyen" value={stats.pending} onPress={() => router.navigate(jobsWith('pending'))} />
            <StatTile label="Atanan" value={stats.assigned} onPress={() => router.navigate(jobsWith('assigned'))} />
            <StatTile label="Devam eden" value={stats.inProgress} onPress={() => router.navigate(jobsWith('active'))} />
            <StatTile label="Tamamlanan" value={stats.completed} onPress={() => router.navigate(jobsWith('completed'))} />
            <StatTile label="İptal edilen" value={stats.cancelled} onPress={() => router.navigate(jobsWith('cancelled'))} />
          </View>

          <View style={styles.actions}>
            <Button label="Yeni iş" icon={Plus} onPress={() => router.push(routes.newJob())} style={{ flex: 1 }} />
            <Button label="Müşteri" icon={Building2} variant="secondary" onPress={() => router.push(routes.newCustomer)} style={{ flex: 1 }} />
            <Button label="Rapor" icon={FileText} variant="secondary" onPress={() => router.navigate('/admin/reports' as Href)} style={{ flex: 1 }} />
          </View>

          <Section title={`Aktif şoförler · ${activeDrivers.length}`} action={activeDrivers.length ? <Button label="Haritada gör" variant="ghost" size="sm" onPress={() => router.navigate(routes.adminMap)} /> : undefined}>
            {activeDrivers.length === 0 ? (
              <EmptyState compact icon={Truck} title="Sahada aktif şoför yok" description="Devam eden işler burada görünür." />
            ) : (
              <Card padded={false}>
                {activeDrivers.map((d, i) => {
                  const loc = locations[d.job.id];
                  return (
                    <View key={d.userId} style={[styles.driver, i < activeDrivers.length - 1 && styles.driverBorder]}>
                      <Avatar name={d.name} />
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text variant="subheading">{d.name}</Text>
                        <Text variant="bodySmall" tone="secondary" numberOfLines={1}>
                          {d.plate ? `${d.plate} · ` : ''}
                          {d.job.customerName}
                        </Text>
                        <Text variant="bodySmall" tone="tertiary">{loc ? `Konum ${formatRelative(loc.fix.timestamp)}` : 'Konum paylaşılmıyor'}</Text>
                      </View>
                      <Badge label={JOB_STATUS_LABEL[d.job.status as JobStatus]} tone={d.job.status === 'accepted' ? 'strong' : 'solid'} dot={d.job.status !== 'accepted'} />
                    </View>
                  );
                })}
              </Card>
            )}
          </Section>

          <Section title="Son oluşturulan işler" action={<Button label="Tümü" variant="ghost" size="sm" onPress={() => router.navigate(routes.adminJobs)} />}>
            <Card style={styles.listCard}>
              {recentCreated.length ? recentCreated.map((j, i) => <JobRow key={j.id} job={j} onPress={openJob} last={i === recentCreated.length - 1} />) : <Text tone="tertiary">Henüz iş yok.</Text>}
            </Card>
          </Section>

          <Section title="Son tamamlanan işler">
            <Card style={styles.listCard}>
              {recentCompleted.length ? recentCompleted.map((j, i) => <JobRow key={j.id} job={j} onPress={openJob} last={i === recentCompleted.length - 1} />) : <Text tone="tertiary">Tamamlanan iş yok.</Text>}
            </Card>
          </Section>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.huge },
  revenue: { gap: spacing.xs, paddingTop: spacing.xs },
  tabular: { fontVariant: ['tabular-nums'] },
  body: { padding: spacing.lg, gap: spacing.xxl },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  actions: { flexDirection: 'row', gap: spacing.sm },
  driver: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg },
  driverBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderStrong },
  listCard: { paddingVertical: spacing.xs },
});
