import { CloudOff, LocateFixed, MapPinOff, Navigation } from 'lucide-react-native';
import { memo } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { Button, Card, Text } from '@/components/ui';
import { useLocationTracking, type TrackingStatus } from '@/contexts/LocationContext';
import { colors, radius, spacing } from '@/theme';
import { formatRelative } from '@/utils/format';

const COPY: Record<TrackingStatus, { title: string; body: string }> = {
  active: { title: 'Konum takibi açık', body: 'İş sürerken konumunuz uygulama arka plandayken de yöneticinizle paylaşılır.' },
  starting: { title: 'Konum takibi başlatılıyor', body: 'GPS sinyali bekleniyor.' },
  denied: { title: 'Konum izni gerekli', body: 'Aktif işiniz için konum takibi zorunludur. Cihaz ayarlarından izni açın.' },
  error: { title: 'Konum takibi başlatılamadı', body: 'Konum servislerini kontrol edip tekrar deneyin.' },
  no_job: { title: 'Takip kapalı', body: 'Konum takibi yalnızca kabul ettiğiniz ve devam eden işler sırasında çalışır.' },
};

/** Zorunlu iş takibinin durumu. Kullanıcı takibi kapatamaz; iş bitince otomatik durur. */
export const LocationShareCard = memo(function LocationShareCard({ compact }: { compact?: boolean }) {
  const { status, lastPublishedAt, pending, error, foregroundOnly, trackingJobs, retry } = useLocationTracking();
  const copy = COPY[status];
  const on = status === 'active' || status === 'starting';
  const Icon = status === 'active' ? Navigation : status === 'denied' || status === 'error' ? MapPinOff : LocateFixed;

  return (
    <Card tone={on ? 'ink' : 'surface'} style={[styles.card, !on && status !== 'no_job' && styles.warn]}>
      <View style={styles.row}>
        <View style={[styles.icon, on && styles.iconOn]}>
          <Icon size={18} color={on ? colors.text : colors.textSecondary} strokeWidth={2} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="subheading" tone={on ? 'inverse' : status === 'no_job' ? 'default' : 'danger'}>{copy.title}</Text>
          {!compact || !on ? (
            <Text variant="bodySmall" tone={on ? 'inverseMuted' : 'secondary'}>
              {(status === 'error' || status === 'denied') && error ? error : copy.body}
            </Text>
          ) : null}
          {on && trackingJobs.length > 1 ? <Text variant="bodySmall" tone="inverseMuted">{trackingJobs.length} aktif iş için paylaşılıyor</Text> : null}
          {on && lastPublishedAt ? <Text variant="bodySmall" tone="inverseMuted">Son gönderim {formatRelative(lastPublishedAt)}</Text> : null}
          {on && foregroundOnly ? <Text variant="bodySmall" tone="inverseMuted">Web önizleme: yalnızca sayfa açıkken gönderilir.</Text> : null}
        </View>
      </View>
      {on && pending > 0 ? (
        <View style={styles.pending}>
          <CloudOff size={14} color={colors.textInverseMuted} />
          <Text variant="bodySmall" tone="inverseMuted">{pending} konum bağlantı bekliyor; internet gelince gönderilecek.</Text>
        </View>
      ) : null}
      {status === 'denied' ? (
        <View style={styles.actions}>
          <Button label="Ayarları aç" variant="secondary" size="sm" onPress={() => Linking.openSettings().catch(() => {})} style={{ flex: 1 }} />
          <Button label="Tekrar dene" size="sm" onPress={() => void retry()} style={{ flex: 1 }} />
        </View>
      ) : status === 'error' ? (
        <Button label="Tekrar dene" size="sm" icon={Navigation} onPress={() => void retry()} />
      ) : null}
    </Card>
  );
});

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  warn: { borderColor: colors.danger, borderWidth: 1.5 },
  row: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  icon: { width: 36, height: 36, borderRadius: radius.sm + 2, backgroundColor: colors.surfaceSunken, alignItems: 'center', justifyContent: 'center' },
  iconOn: { backgroundColor: colors.surface },
  pending: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  actions: { flexDirection: 'row', gap: spacing.sm },
});
