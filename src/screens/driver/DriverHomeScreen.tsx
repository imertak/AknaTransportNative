import { router } from 'expo-router';
import { CalendarCheck2 } from 'lucide-react-native';
import { useCallback } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { DriverActionCard } from '@/components/jobs/DriverActionCard';
import { JobCard } from '@/components/jobs/JobCard';
import { LocationShareCard } from '@/components/jobs/LocationShareCard';
import { Button, EmptyState, PageHeader, Screen, Section, Text } from '@/components/ui';
import { ViewModeBanner } from '@/components/ViewModeBanner';
import { isTrackable } from '@/constants/jobStatus';
import { can } from '@/constants/permissions';
import { useCurrentUser } from '@/contexts/AuthContext';
import { useDriverJobs, useVehicles } from '@/hooks/useData';
import { useRefresh } from '@/hooks/useRefresh';
import { routes } from '@/navigation/routes';
import { colors, radius, spacing } from '@/theme';
import type { TransportJob } from '@/types';
import { formatDateLong, todayISO } from '@/utils/format';

export default function DriverHomeScreen() {
  const user = useCurrentUser();
  const vehicles = useVehicles();
  const { active, today, waiting, completed, open } = useDriverJobs(user.id);
  const { refreshing, onRefresh } = useRefresh();
  const vehicle = vehicles.find((v) => v.id === user.vehicleId);
  const showPrice = can(user, 'jobs.viewPrice');
  const openJob = useCallback((job: TransportJob) => router.push(routes.job(job.id, 'driver')), []);

  const todayOthers = today.filter((j) => j.id !== active?.id && j.status !== 'assigned');
  const nextUp = !active ? open.find((j) => j.status === 'assigned') : undefined;

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ paddingBottom: spacing.huge }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.textInverseMuted} />}>
        <PageHeader overline={formatDateLong(todayISO())} title={`Merhaba, ${user.fullName.split(' ')[0]}`} subtitle={vehicle ? `${vehicle.plate} · ${vehicle.model}` : undefined}>
          <View style={styles.stats}>
            <Stat label="Bugün" value={today.length} />
            <Stat label="Bekleyen" value={waiting.length} />
            <Stat label="Tamamlanan" value={completed.length} />
          </View>
        </PageHeader>

        <View style={styles.body}>
          <ViewModeBanner />

          <Section title="Aktif işim">
            {active ? (
              <View style={{ gap: spacing.md }}>
                <JobCard job={active} onPress={openJob} showPrice={showPrice} />
                <DriverActionCard job={active} />
                {isTrackable(active.status) ? <LocationShareCard compact /> : null}
              </View>
            ) : nextUp ? (
              <View style={{ gap: spacing.md }}>
                <Text variant="bodySmall" tone="secondary">Şu an devam eden işiniz yok. Sıradaki işinizi kabul ederek başlayabilirsiniz.</Text>
                <JobCard job={nextUp} onPress={openJob} showPrice={showPrice} />
                <DriverActionCard job={nextUp} />
              </View>
            ) : (
              <EmptyState icon={CalendarCheck2} title="Aktif işiniz yok" description="Size yeni bir iş atandığında burada görünecek." />
            )}
          </Section>

          {waiting.filter((j) => j.id !== nextUp?.id).length ? (
            <Section title="Kabul bekleyen işlerim" action={<Button label="Tümü" variant="ghost" size="sm" onPress={() => router.navigate(routes.driverJobs)} />}>
              {waiting
                .filter((j) => j.id !== nextUp?.id)
                .map((j) => (
                  <JobCard key={j.id} job={j} onPress={openJob} showPrice={showPrice} />
                ))}
            </Section>
          ) : null}

          {todayOthers.length ? (
            <Section title="Bugünkü işlerim">
              {todayOthers.map((j) => (
                <JobCard key={j.id} job={j} onPress={openJob} showPrice={showPrice} />
              ))}
            </Section>
          ) : null}
        </View>
      </ScrollView>
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.stat}>
      <Text variant="number" tone="inverse">{value}</Text>
      <Text variant="bodySmall" tone="inverseMuted">{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  stats: { flexDirection: 'row', gap: spacing.sm },
  stat: { flex: 1, backgroundColor: colors.inkRaised, borderWidth: 1, borderColor: colors.inkLine, borderRadius: radius.md, padding: spacing.md, gap: 2 },
  body: { padding: spacing.lg, gap: spacing.xxl },
});
