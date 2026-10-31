import { ArrowRight, CircleCheck, MapPinOff } from 'lucide-react-native';
import { memo, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { Button, Card, Text } from '@/components/ui';
import { DRIVER_FLOW, IN_PROGRESS_STATUSES } from '@/constants/jobStatus';
import { useToast } from '@/contexts/ToastContext';
import { useCurrentUser } from '@/contexts/AuthContext';
import { useLocationTracking } from '@/contexts/LocationContext';
import { useAsyncAction } from '@/hooks/useAsyncAction';
import { jobActions } from '@/store';
import { colors, radius, spacing } from '@/theme';
import type { TransportJob } from '@/types';
import { confirm } from '@/utils/confirm';

const STEPS = ['assigned', ...IN_PROGRESS_STATUSES, 'completed'] as const;

/** Şoförün işi bir sonraki aşamaya taşıdığı kart. */
export const DriverActionCard = memo(function DriverActionCard({ job }: { job: TransportJob }) {
  const user = useCurrentUser();
  const { ensureReady, startNow } = useLocationTracking();
  const toast = useToast();
  const { run, pending } = useAsyncAction();
  const [blocked, setBlocked] = useState<{ message: string; settings: boolean } | null>(null);
  const action = DRIVER_FLOW[job.status];
  if (!action || job.driverId !== user.id) return null;

  const stepIndex = STEPS.indexOf(job.status as (typeof STEPS)[number]);

  const onPress = async () => {
    if (action.next === 'completed') {
      const ok = await confirm({ title: 'İşi tamamla', message: 'Teslimatın tamamlandığını onaylıyor musunuz? Bu işlem geri alınamaz.', confirmLabel: 'Tamamla' });
      if (!ok) return;
    }
    if (action.next === 'accepted') {
      // Konum takibi zorunlu: izin/servis yoksa iş kabul edilmez.
      const ready = await ensureReady();
      if (!ready.ok) {
        setBlocked({ message: ready.message, settings: !ready.canAskAgain || ready.code === 'background_denied' });
        return;
      }
      setBlocked(null);
      const accepted = await run(() => jobActions.advance(job.id, 'accepted', user.id));
      if (!accepted) return;
      try {
        await startNow();
        toast.show('İş kabul edildi. Konum takibi başladı.', 'success');
      } catch (e) {
        toast.show(`İş kabul edildi ancak konum takibi başlatılamadı: ${e instanceof Error ? e.message : ''} Tekrar deneyin.`, 'error');
      }
      return;
    }
    await run(() => jobActions.advance(job.id, action.next, user.id), {
      success: action.next === 'completed' ? 'İş tamamlandı. Konum takibi durduruldu.' : `Durum güncellendi: ${action.label}`,
    });
  };

  return (
    <Card style={styles.card}>
      <View style={styles.progress} accessibilityLabel={`Adım ${stepIndex + 1} / ${STEPS.length - 1}`}>
        {STEPS.slice(0, -1).map((s, i) => (
          <View key={s} style={[styles.seg, i <= stepIndex && styles.segDone]} />
        ))}
      </View>
      <View style={{ gap: 2 }}>
        <Text variant="caption" tone="tertiary">Sıradaki adım</Text>
        <Text variant="heading">{action.label}</Text>
        <Text variant="bodySmall" tone="secondary">{action.description}</Text>
      </View>
      {blocked ? (
        <View style={styles.blocked} accessibilityRole="alert">
          <View style={styles.blockedHead}>
            <MapPinOff size={16} color={colors.danger} />
            <Text variant="subheading" tone="danger">Konum izni olmadan iş kabul edilemez</Text>
          </View>
          <Text variant="bodySmall" tone="secondary">{blocked.message}</Text>
          {blocked.settings ? <Button label="Ayarları aç" variant="secondary" size="sm" onPress={() => Linking.openSettings().catch(() => {})} /> : null}
        </View>
      ) : null}
      <Button
        label={action.label}
        size="lg"
        icon={action.next === 'completed' ? CircleCheck : ArrowRight}
        iconPosition={action.next === 'completed' ? 'left' : 'right'}
        onPress={onPress}
        loading={pending}
        fullWidth
      />
    </Card>
  );
});

const styles = StyleSheet.create({
  card: { gap: spacing.lg, borderColor: colors.ink, borderWidth: 1.5 },
  progress: { flexDirection: 'row', gap: 4 },
  seg: { flex: 1, height: 4, borderRadius: radius.pill, backgroundColor: colors.surfaceSunken },
  segDone: { backgroundColor: colors.ink },
  blocked: { gap: spacing.xs, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.dangerSoft },
  blockedHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
});
