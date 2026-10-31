import { ArrowRight, CircleCheck } from 'lucide-react-native';
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Card, Text } from '@/components/ui';
import { DRIVER_FLOW, IN_PROGRESS_STATUSES } from '@/constants/jobStatus';
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
  const { sharing, startSharing } = useLocationTracking();
  const { run, pending } = useAsyncAction();
  const action = DRIVER_FLOW[job.status];
  if (!action || job.driverId !== user.id) return null;

  const stepIndex = STEPS.indexOf(job.status as (typeof STEPS)[number]);

  const onPress = async () => {
    if (action.next === 'completed') {
      const ok = await confirm({ title: 'İşi tamamla', message: 'Teslimatın tamamlandığını onaylıyor musunuz? Bu işlem geri alınamaz.', confirmLabel: 'Tamamla' });
      if (!ok) return;
    }
    const updated = await run(() => jobActions.advance(job.id, action.next, user.id), {
      success: action.next === 'completed' ? 'İş tamamlandı.' : `Durum güncellendi: ${action.label}`,
    });
    // Yola çıkıldığında konum paylaşımını otomatik başlat
    if (updated && action.next === 'on_the_way' && !sharing) void startSharing();
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
});
