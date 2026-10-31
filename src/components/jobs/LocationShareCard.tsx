import { LocateFixed, LocateOff, MapPinOff, Navigation } from 'lucide-react-native';
import { memo } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { Button, Card, Text } from '@/components/ui';
import { useLocationTracking, type TrackingStatus } from '@/contexts/LocationContext';
import { colors, radius, spacing } from '@/theme';
import { formatRelative } from '@/utils/format';

const COPY: Record<TrackingStatus, { title: string; body: string }> = {
  active: { title: 'Konum paylaşılıyor', body: 'Konumunuz yalnızca anlamlı hareket olduğunda güncellenir.' },
  starting: { title: 'Konum alınıyor', body: 'GPS sinyali bekleniyor.' },
  paused: { title: 'Paylaşım duraklatıldı', body: 'Uygulama arka planda. Uygulamaya döndüğünüzde paylaşım devam eder.' },
  off: { title: 'Konum paylaşımı kapalı', body: 'Yöneticinin aracınızı haritada görebilmesi için paylaşımı başlatın.' },
  denied: { title: 'Konum izni verilmedi', body: 'Paylaşım için cihaz ayarlarından konum iznini açın.' },
  error: { title: 'Konum alınamadı', body: 'Konum servislerini kontrol edip tekrar deneyin.' },
  no_job: { title: 'Aktif iş yok', body: 'Konum paylaşımı yalnızca yoldaki bir iş sırasında çalışır.' },
};

export const LocationShareCard = memo(function LocationShareCard({ compact }: { compact?: boolean }) {
  const { status, lastPublishedAt, error, startSharing, stopSharing } = useLocationTracking();
  const copy = COPY[status];
  const on = status === 'active' || status === 'starting' || status === 'paused';
  const Icon = status === 'active' ? Navigation : status === 'denied' || status === 'error' ? MapPinOff : on ? LocateFixed : LocateOff;

  return (
    <Card tone={on ? 'ink' : 'surface'} style={styles.card}>
      <View style={styles.row}>
        <View style={[styles.icon, on && styles.iconOn]}>
          <Icon size={18} color={on ? colors.text : colors.textSecondary} strokeWidth={2} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="subheading" tone={on ? 'inverse' : 'default'}>{copy.title}</Text>
          {!compact || !on ? (
            <Text variant="bodySmall" tone={on ? 'inverseMuted' : 'secondary'}>
              {status === 'error' && error ? error : copy.body}
            </Text>
          ) : null}
          {on && lastPublishedAt ? <Text variant="bodySmall" tone="inverseMuted">Son güncelleme {formatRelative(lastPublishedAt)}</Text> : null}
        </View>
      </View>
      {status === 'no_job' ? null : status === 'denied' ? (
        <Button label="Ayarları aç" variant="secondary" size="sm" onPress={() => Linking.openSettings().catch(() => {})} />
      ) : on ? (
        <Button label="Paylaşımı durdur" variant="inverse" size="sm" onPress={stopSharing} />
      ) : (
        <Button label={status === 'error' ? 'Tekrar dene' : 'Paylaşımı başlat'} size="sm" icon={Navigation} onPress={() => void startSharing()} />
      )}
    </Card>
  );
});

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  row: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  icon: { width: 36, height: 36, borderRadius: radius.sm + 2, backgroundColor: colors.surfaceSunken, alignItems: 'center', justifyContent: 'center' },
  iconOn: { backgroundColor: colors.surface },
});
