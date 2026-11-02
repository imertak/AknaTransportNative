import { router } from 'expo-router';
import { Navigation } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { RouteLine } from '@/components/jobs/RouteLine';
import { LocationShareCard } from '@/components/jobs/LocationShareCard';
import { MapCanvas } from '@/components/map/MapCanvas';
import { MapPanel, MapTitle } from '@/components/map/MapOverlay';
import type { MapMarkerData } from '@/components/map/types';
import { Button, Card, Chip, StatusBadge, Text } from '@/components/ui';
import { useCurrentUser } from '@/contexts/AuthContext';
import { useLocationTracking } from '@/contexts/LocationContext';
import { useDriverJobs } from '@/hooks/useData';
import { routes } from '@/navigation/routes';
import { colors, spacing } from '@/theme';
import type { TransportJob } from '@/types';
import { distanceMeters, formatDistance } from '@/utils/geo';
import { openDirections } from '@/utils/links';

/** Yükleme tamamlandıktan sonra hedef teslimat noktasıdır. */
const headingToDelivery = (job: TransportJob) => job.status === 'loading' || job.status === 'delivering';

/** İşin konumu kayıtlı tüm yükleme ve teslimat noktaları. Koordinatı olmayan adres haritaya konmaz. */
function stopMarkers(job: TransportJob): MapMarkerData[] {
  const out: MapMarkerData[] = [];
  for (const stop of job.stops) {
    if (!stop.point) continue;
    out.push({
      id: `${job.id}_${stop.type}_${stop.sequence}`,
      kind: stop.type,
      coordinate: stop.point,
      title: `${stop.type === 'pickup' ? 'Yükleme' : 'Teslimat'} ${stop.sequence}`,
      subtitle: stop.address,
    });
  }
  if (job.stops.length === 0) {
    if (job.pickupPoint) out.push({ id: `${job.id}_pickup`, kind: 'pickup', coordinate: job.pickupPoint, title: 'Yükleme', subtitle: job.pickupAddress });
    if (job.deliveryPoint) out.push({ id: `${job.id}_delivery`, kind: 'delivery', coordinate: job.deliveryPoint, title: 'Teslimat', subtitle: job.deliveryAddress });
  }
  return out;
}

export default function DriverMapScreen() {
  const user = useCurrentUser();
  const { active, open } = useDriverJobs(user.id);
  const { lastFix, locationOn } = useLocationTracking();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Seçilen iş; seçim yoksa devam eden iş, o da yoksa üstüme atanmış ilk iş.
  const job = open.find((j) => j.id === selectedId) ?? active ?? open[0];

  const jobMarkers = useMemo(() => (job ? stopMarkers(job) : []), [job]);
  const markers = useMemo<MapMarkerData[]>(
    () => (lastFix ? [...jobMarkers, { id: 'me', kind: 'vehicle', coordinate: lastFix, title: 'Konumum' }] : jobMarkers),
    [jobMarkers, lastFix],
  );

  const target = job ? (headingToDelivery(job) ? job.deliveryPoint : job.pickupPoint) : undefined;
  const distance = lastFix && target ? distanceMeters(lastFix, target) : null;

  return (
    <View style={styles.root}>
      <MapCanvas markers={markers} showsUserLocation={locationOn} bottomInset={300} />
      <MapTitle
        title="Harita"
        subtitle={job ? `${job.jobNo} · ${job.customerName}` : 'Üstünüze atanmış iş yok'}
      />
      <MapPanel>
        {job ? (
          <Card style={{ gap: spacing.md }}>
            {open.length > 1 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                {open.map((j) => (
                  <Chip key={j.id} label={j.jobNo} active={j.id === job.id} onPress={() => setSelectedId(j.id)} />
                ))}
              </ScrollView>
            ) : null}
            <View style={styles.row}>
              <StatusBadge status={job.status} />
              {distance !== null ? <Text variant="label" tone="secondary">Hedefe {formatDistance(distance)}</Text> : null}
              <Text variant="label" onPress={() => router.push(routes.job(job.id, 'driver'))} accessibilityRole="link">
                İş detayı
              </Text>
            </View>
            <RouteLine pickup={job.pickupAddress} delivery={job.deliveryAddress} compact extraStops={Math.max(0, job.stops.length - 2)} />
            {jobMarkers.length === 0 ? (
              <Text variant="bodySmall" tone="secondary">Bu işin adresleri haritada işaretlenmemiş; yol tarifi adrese göre açılır.</Text>
            ) : null}
            <Button
              label={headingToDelivery(job) ? 'Teslimata yol tarifi' : 'Yüklemeye yol tarifi'}
              icon={Navigation}
              variant="secondary"
              size="sm"
              onPress={() =>
                headingToDelivery(job) ? openDirections(job.deliveryAddress, job.deliveryPoint) : openDirections(job.pickupAddress, job.pickupPoint)
              }
            />
          </Card>
        ) : null}
        <LocationShareCard compact />
      </MapPanel>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surfaceSunken },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chips: { gap: spacing.xs },
});
