import { router } from 'expo-router';
import { Navigation } from 'lucide-react-native';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { RouteLine } from '@/components/jobs/RouteLine';
import { MapCanvas } from '@/components/map/MapCanvas';
import { MapPanel, MapTitle } from '@/components/map/MapOverlay';
import type { MapMarkerData } from '@/components/map/types';
import { LocationShareCard } from '@/components/jobs/LocationShareCard';
import { Button, Card, StatusBadge, Text } from '@/components/ui';
import { useCurrentUser } from '@/contexts/AuthContext';
import { useLocationTracking } from '@/contexts/LocationContext';
import { useDriverJobs } from '@/hooks/useData';
import { routes } from '@/navigation/routes';
import { colors, spacing } from '@/theme';
import { distanceMeters, formatDistance } from '@/utils/geo';
import { openDirections } from '@/utils/links';

export default function DriverMapScreen() {
  const user = useCurrentUser();
  const { active } = useDriverJobs(user.id);
  const { lastFix, status } = useLocationTracking();

  const markers = useMemo<MapMarkerData[]>(() => {
    const out: MapMarkerData[] = [];
    const showPickups = active?.status === 'accepted' || active?.status === 'on_the_way';
    // Konumu kayıtlı tüm duraklar sırasıyla gösterilir.
    for (const stop of active?.stops ?? []) {
      if (!stop.point || (stop.type === 'pickup' && !showPickups)) continue;
      out.push({
        id: `${stop.type}_${stop.sequence}`,
        kind: stop.type,
        coordinate: stop.point,
        title: `${stop.type === 'pickup' ? 'Yükleme' : 'Teslimat'} ${stop.sequence}`,
        subtitle: stop.address,
      });
    }
    if (lastFix) out.push({ id: 'me', kind: 'vehicle', coordinate: lastFix, title: 'Aracım' });
    return out;
  }, [active, lastFix]);

  const target = active ? (active.status === 'loading' || active.status === 'delivering' ? active.deliveryPoint : active.pickupPoint) : undefined;
  const distance = lastFix && target ? distanceMeters(lastFix, target) : null;

  return (
    <View style={styles.root}>
      <MapCanvas markers={markers} showsUserLocation={status === 'active'} bottomInset={260} />
      <MapTitle title="Harita" subtitle={active ? `${active.jobNo} · ${active.customerName}` : 'Aktif iş yok'} />
      <MapPanel>
        {active ? (
          <Card style={{ gap: spacing.md }}>
            <View style={styles.row}>
              <StatusBadge status={active.status} />
              {distance !== null ? <Text variant="label" tone="secondary">Hedefe {formatDistance(distance)}</Text> : null}
              <Text variant="label" onPress={() => router.push(routes.job(active.id, 'driver'))} accessibilityRole="link">
                İş detayı
              </Text>
            </View>
            <RouteLine pickup={active.pickupAddress} delivery={active.deliveryAddress} compact extraStops={Math.max(0, active.stops.length - 2)} />
            <Button
              label={active.status === 'loading' || active.status === 'delivering' ? 'Teslimata yol tarifi' : 'Yüklemeye yol tarifi'}
              icon={Navigation}
              variant="secondary"
              size="sm"
              onPress={() =>
                active.status === 'loading' || active.status === 'delivering'
                  ? openDirections(active.deliveryAddress, active.deliveryPoint)
                  : openDirections(active.pickupAddress, active.pickupPoint)
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
});
