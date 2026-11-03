import { router, useLocalSearchParams } from 'expo-router';
import { ArchiveRestore, Building2, CalendarDays, CarFront, Trash2, UserRoundCog } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { StatusTimeline } from '@/components/jobs/StatusTimeline';
import { StopList } from '@/components/jobs/StopList';
import { Button, Card, ErrorState, InfoRow, LoadingState, NavHeader, Screen, ScrollContent, Section, StatusBadge, Text } from '@/components/ui';
import { useAsyncAction } from '@/hooks/useAsyncAction';
import { useUserMap } from '@/hooks/useData';
import { routes } from '@/navigation/routes';
import { errorMessage } from '@/services/errors';
import { jobService } from '@/services/registry';
import { jobActions } from '@/store';
import { colors, spacing } from '@/theme';
import type { TransportJob } from '@/types';
import { confirm } from '@/utils/confirm';
import { formatCurrency, formatDateLong, formatDateTime, partyLabel } from '@/utils/format';

/** Silinmiş işin salt okunur detayı: silme bilgisi, güzergah ve durum geçmişi; yönetici işi geri alabilir. */
export default function DeletedJobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const userMap = useUserMap();
  const { run, pending } = useAsyncAction();
  const [job, setJob] = useState<TransportJob>();
  const [error, setError] = useState<string>();

  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!id) return;
    let alive = true;
    jobService.getDeleted(id).then(
      (loaded) => {
        if (!alive) return;
        setError(undefined);
        setJob(loaded);
      },
      (e) => alive && setError(errorMessage(e, 'İş yüklenemedi.')),
    );
    return () => {
      alive = false;
    };
  }, [id, attempt]);

  if (!job) {
    return (
      <Screen>
        <NavHeader title="Silinen iş" />
        {error ? <ErrorState message={error} onRetry={() => setAttempt((n) => n + 1)} /> : <LoadingState />}
      </Screen>
    );
  }

  const restore = async () => {
    const ok = await confirm({
      title: 'İşi geri al',
      message: `${job.jobNo} numaralı iş yeniden iş listelerinde görünecek. Durumu (${job.status === 'cancelled' ? 'iptal' : 'mevcut aşama'}) ve geçmişi değişmez.`,
      confirmLabel: 'Geri al',
    });
    if (!ok) return;
    const restored = await run(() => jobActions.restore(job.id), { success: 'İş geri alındı.', error: 'İş geri alınamadı.' });
    if (restored) router.replace(routes.job(restored.id));
  };

  return (
    <Screen>
      <NavHeader title={job.jobNo} subtitle={job.customerName} />
      <ScrollContent>
        <Card style={styles.deleted}>
          <View style={styles.row}>
            <Trash2 size={20} color={colors.danger} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="subheading">Bu iş silindi</Text>
              <Text variant="bodySmall" tone="secondary">
                {[job.deletedAt ? formatDateTime(job.deletedAt) : undefined, job.deletedByName].filter(Boolean).join(' · ') || '—'}
              </Text>
              {job.deletionReason ? <Text variant="bodySmall">Neden: {job.deletionReason}</Text> : null}
              <Text variant="bodySmall" tone="tertiary">
                Silinen iş listelerde, haritada ve raporlarda görünmez. Kayıtlar denetim için saklanır.
              </Text>
            </View>
          </View>
          <Button label="İşi geri al" variant="secondary" icon={ArchiveRestore} onPress={restore} loading={pending} />
        </Card>

        <Card style={{ gap: spacing.sm }}>
          <View style={styles.top}>
            <StatusBadge status={job.status} />
            <Text variant="title" style={{ fontVariant: ['tabular-nums'] }}>
              {formatCurrency(job.price)}
            </Text>
          </View>
          <Text variant="heading">{partyLabel(job.customerName, job.storeName)}</Text>
          {job.status === 'cancelled' && job.cancellationReason ? (
            <Text variant="bodySmall" tone="secondary">
              İptal nedeni: {job.cancellationReason}
            </Text>
          ) : null}
        </Card>

        <Section title="Bilgiler">
          <Card padded={false} style={styles.listCard}>
            <InfoRow icon={CalendarDays} label="Tarih" value={formatDateLong(job.date)} />
            <InfoRow icon={Building2} label="Firma" value={job.customerName} />
            <InfoRow icon={UserRoundCog} label="Şoför" value={(job.driverId && userMap.get(job.driverId)?.fullName) || 'Atanmadı'} />
            <InfoRow icon={CarFront} label="Araç" value={job.vehiclePlate ?? 'Seçilmedi'} last />
          </Card>
        </Section>

        <Section title={`Güzergah · ${job.stops.length} durak`}>
          <Card style={{ gap: spacing.lg }}>
            <StopList stops={job.stops} navigable={false} />
          </Card>
        </Section>

        <Section title="Durum geçmişi">
          <Card>
            <StatusTimeline events={job.statusHistory} users={userMap} />
          </Card>
        </Section>
      </ScrollContent>
    </Screen>
  );
}

const styles = StyleSheet.create({
  deleted: { gap: spacing.md, borderWidth: 1, borderColor: colors.dangerBorder },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  listCard: { paddingHorizontal: spacing.lg },
});
