import { router } from 'expo-router';
import { RefreshCw, Truck } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import { MapCanvas } from '@/components/map/MapCanvas';
import { MapPanel, MapTitle } from '@/components/map/MapOverlay';
import type { MapMarkerData } from '@/components/map/types';
import { Badge, IconButton, StatusBadge, Text } from '@/components/ui';
import { isInProgress } from '@/constants/jobStatus';
import { useJobs, useLocations, useUserMap, useVehicles } from '@/hooks/useData';
import { routes } from '@/navigation/routes';
import { locationActions } from '@/store';
import { colors, radius, spacing } from '@/theme';
import type { TransportJob, VehicleLocation } from '@/types';
import { formatRelative } from '@/utils/format';

interface ActiveItem {
  job: TransportJob;
  location?: VehicleLocation;
  driverName: string;
  plate?: string;
}

const CARD_WIDTH = 280;

export default function FleetMapScreen() {
  const jobs = useJobs();
  const locations = useLocations();
  const userMap = useUserMap();
  const vehicles = useVehicles();
  const [focusId, setFocusId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const items = useMemo<ActiveItem[]>(
    () =>
      jobs
        .filter((j) => isInProgress(j.status) && j.driverId)
        .map((job) => {
          const driver = userMap.get(job.driverId!);
          return {
            job,
            location: locations[job.id],
            driverName: driver?.fullName ?? 'Şoför',
            plate: vehicles.find((v) => v.id === driver?.vehicleId)?.plate,
          };
        }),
    [jobs, locations, userMap, vehicles],
  );

  const markers = useMemo<MapMarkerData[]>(() => {
    const out: MapMarkerData[] = [];
    for (const it of items) {
      if (it.location) out.push({ id: `v_${it.job.id}`, kind: 'vehicle', coordinate: it.location.fix, title: `${it.driverName}${it.plate ? ` · ${it.plate}` : ''}`, subtitle: it.job.customerName });
      if (it.job.deliveryPoint) out.push({ id: `d_${it.job.id}`, kind: 'delivery', coordinate: it.job.deliveryPoint, title: `Teslimat · ${it.job.customerName}`, subtitle: it.job.deliveryAddress });
    }
    return out;
  }, [items]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await locationActions.refresh();
    } finally {
      setRefreshing(false);
    }
  }, []);

  const sharingCount = items.filter((i) => i.location).length;

  return (
    <View style={styles.root}>
      <MapCanvas markers={markers} focusId={focusId} bottomInset={170} onMarkerPress={(id) => setFocusId(id)} />
      <MapTitle
        title="Araç takibi"
        subtitle={`${items.length} aktif iş · ${sharingCount} araç konum paylaşıyor`}
        right={<IconButton icon={RefreshCw} label="Konumları yenile" tone="dark" onPress={refresh} size={38} style={refreshing && { opacity: 0.5 }} />}
      />
      <MapPanel>
        {items.length === 0 ? (
          <View style={styles.empty}>
            <Truck size={18} color={colors.textSecondary} />
            <Text variant="bodySmall" tone="secondary" style={{ flex: 1 }}>Şu anda sahada aktif iş yok. Devam eden işler ve araç konumları burada görünür.</Text>
          </View>
        ) : (
          <FlatList
            horizontal
            data={items}
            keyExtractor={(i) => i.job.id}
            showsHorizontalScrollIndicator={false}
            snapToInterval={CARD_WIDTH + spacing.sm}
            decelerationRate="fast"
            contentContainerStyle={{ gap: spacing.sm }}
            style={{ marginHorizontal: -spacing.lg }}
            ListHeaderComponent={<View style={{ width: spacing.lg - spacing.sm }} />}
            ListFooterComponent={<View style={{ width: spacing.lg - spacing.sm }} />}
            renderItem={({ item }) => {
              const focused = focusId === `v_${item.job.id}`;
              return (
                <Pressable
                  onPress={() => (item.location ? setFocusId(`v_${item.job.id}`) : router.push(routes.job(item.job.id)))}
                  onLongPress={() => router.push(routes.job(item.job.id))}
                  accessibilityRole="button"
                  accessibilityHint="Uzun basarak iş detayını açın"
                  style={[styles.card, focused && styles.cardFocused]}>
                  <View style={styles.cardTop}>
                    <Text variant="subheading" numberOfLines={1} style={{ flex: 1 }}>{item.driverName}</Text>
                    <StatusBadge status={item.job.status} />
                  </View>
                  <Text variant="bodySmall" tone="secondary" numberOfLines={1}>
                    {item.plate ? `${item.plate} · ` : ''}
                    {item.job.customerName}
                  </Text>
                  <View style={styles.cardBottom}>
                    <Text variant="bodySmall" tone="tertiary">
                      {item.location ? `Konum ${formatRelative(item.location.fix.timestamp)}` : 'Konum paylaşılmıyor'}
                    </Text>
                    {item.location?.simulated ? <Badge label="Demo konum" tone="muted" /> : null}
                  </View>
                  <Text variant="label" onPress={() => router.push(routes.job(item.job.id))} accessibilityRole="link">
                    İş detayı
                  </Text>
                </Pressable>
              );
            }}
          />
        )}
      </MapPanel>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surfaceSunken },
  empty: { flexDirection: 'row', gap: spacing.md, alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  card: { width: CARD_WIDTH, backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, gap: 6, borderWidth: 1, borderColor: colors.border },
  cardFocused: { borderColor: colors.ink, borderWidth: 1.5 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  cardBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
});
