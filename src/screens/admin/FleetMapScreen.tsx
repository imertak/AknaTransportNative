import { router, useLocalSearchParams } from 'expo-router';
import { Crosshair, Maximize2, Phone, RefreshCw, Truck, X } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, Linking, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MapCanvas } from '@/components/map/MapCanvas';
import { MapPanel, MapTitle } from '@/components/map/MapOverlay';
import type { MapVehicle } from '@/components/map/types';
import { Button, IconButton, StatusBadge, Text } from '@/components/ui';
import { MAP_CONFIG } from '@/constants/config';
import { isInProgress } from '@/constants/jobStatus';
import { useRealtime } from '@/contexts/RealtimeContext';
import { useJobs, useLocations, useUserMap, useVehicles } from '@/hooks/useData';
import { useJobRoute } from '@/hooks/useJobRoute';
import { useLegRoute } from '@/hooks/useLegRoute';
import { useNow } from '@/hooks/useNow';
import { routes } from '@/navigation/routes';
import { locationActions } from '@/store';
import { colors, radius, spacing } from '@/theme';
import type { LocationFix, TransportJob } from '@/types';
import { formatRelative } from '@/utils/format';
import { jobMapStops } from '@/utils/jobMap';

/** Haritadaki bir araç: aynı şoförün birden fazla aktif işi tek işaretçide toplanır. */
interface FleetVehicle {
  /** Şoför kimliği (işaretçi kimliği). */
  id: string;
  driverName: string;
  driverPhone?: string;
  plate?: string;
  jobs: TransportJob[];
  fix?: LocationFix;
}

const CARD_WIDTH = 280;

const speedText = (fix?: LocationFix) => (fix?.speed != null && fix.speed >= 0 ? `${Math.round(fix.speed * 3.6)} km/sa` : null);

export default function FleetMapScreen() {
  const params = useLocalSearchParams<{ jobId?: string }>();
  const insets = useSafeAreaInsets();
  const jobs = useJobs();
  const locations = useLocations();
  const userMap = useUserMap();
  const vehicles = useVehicles();
  const { status: liveStatus } = useRealtime();
  const now = useNow(30_000);
  /** undefined: kullanıcı henüz seçim yapmadı (iş detayından gelindiyse o işin aracı seçili açılır). */
  const [selection, setSelection] = useState<{ id: string | null; follow: boolean } | undefined>(undefined);
  const [refreshing, setRefreshing] = useState(false);

  const fleet = useMemo<FleetVehicle[]>(() => {
    const byDriver = new Map<string, FleetVehicle>();
    for (const job of jobs) {
      if (!isInProgress(job.status) || !job.driverId) continue;
      let v = byDriver.get(job.driverId);
      if (!v) {
        const driver = userMap.get(job.driverId);
        v = {
          id: job.driverId,
          driverName: driver?.fullName ?? 'Şoför',
          driverPhone: driver?.phone,
          plate: job.vehiclePlate ?? vehicles.find((x) => x.isActive && x.driverId === job.driverId)?.plate,
          jobs: [],
        };
        byDriver.set(job.driverId, v);
      }
      v.jobs.push(job);
      const loc = locations[job.id];
      if (loc && (!v.fix || loc.fix.timestamp > v.fix.timestamp)) v.fix = loc.fix;
    }
    return [...byDriver.values()].sort((a, b) => a.driverName.localeCompare(b.driverName, 'tr'));
  }, [jobs, locations, userMap, vehicles]);

  // İş detayından "Haritada göster" ile gelindiyse (?jobId=) ilgili araç seçili ve canlı takipte açılır.
  const paramVehicle = params.jobId ? fleet.find((f) => f.jobs.some((j) => j.id === params.jobId)) : undefined;
  const chosen = selection ?? { id: paramVehicle?.id ?? null, follow: !!paramVehicle?.fix };
  // Seçili araç sahadan çıkarsa (iş tamamlandı/iptal/silindi) kendiliğinden filo görünümüne dönülür.
  const selected = chosen.id ? fleet.find((v) => v.id === chosen.id) : undefined;
  const selectedId = selected ? selected.id : null;
  const follow = !!selected && chosen.follow;
  const setFollow = (f: boolean) => setSelection((s) => ({ id: s?.id ?? selectedId, follow: f }));

  const isStale = useCallback((fix?: LocationFix) => !!fix && now - fix.timestamp > MAP_CONFIG.staleAfterMs, [now]);

  const mapVehicles = useMemo<MapVehicle[]>(
    () =>
      fleet
        .filter((v) => v.fix)
        .map((v) => ({ id: v.id, coordinate: v.fix!, heading: v.fix!.heading, label: v.plate ?? v.driverName.split(' ')[0], stale: isStale(v.fix) })),
    [fleet, isStale],
  );

  const selectedJob = selected?.jobs[0];
  const stops = selectedJob ? jobMapStops(selectedJob) : [];
  const route = useJobRoute(stops);
  // Seçili aracın gittiği durağa kalan yol.
  const leg = useLegRoute(selected?.fix, stops.find((s) => s.target)?.coordinate);

  const select = useCallback((id: string | null) => setSelection({ id, follow: false }), []);
  const startFollow = useCallback((id: string) => setSelection({ id, follow: true }), []);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await locationActions.refresh();
    } finally {
      setRefreshing(false);
    }
  }, []);

  const sharingCount = mapVehicles.length;
  const liveText = liveStatus === 'connected' ? 'canlı' : liveStatus === 'disconnected' ? 'canlı bağlantı yok' : 'bağlanıyor…';
  const panelHeight = selected ? 250 : 170;

  return (
    <View style={styles.root}>
      <MapCanvas
        vehicles={mapVehicles}
        stops={stops}
        route={route}
        leg={leg}
        selectedVehicleId={selectedId}
        follow={follow}
        fitKey={selectedId ?? 'fleet'}
        onVehiclePress={startFollow}
        onMapPress={() => setFollow(false)}
        onUserGesture={() => setFollow(false)}
        topInset={insets.top + 64}
        bottomInset={panelHeight}
      />
      <MapTitle
        title={selected ? (selected.plate ?? selected.driverName) : 'Araç takibi'}
        subtitle={selected ? `${selected.driverName} · ${liveText}` : `${fleet.length} aktif araç · ${sharingCount} konum paylaşıyor · ${liveText}`}
        right={
          selected ? (
            <IconButton icon={X} label="Filo görünümüne dön" tone="dark" onPress={() => select(null)} size={38} />
          ) : (
            <IconButton icon={RefreshCw} label="Konumları yenile" tone="dark" onPress={refresh} size={38} style={refreshing && { opacity: 0.5 }} />
          )
        }
      />
      <MapPanel>
        {selected ? (
          <VehicleCard vehicle={selected} stale={isStale(selected.fix)} now={now} follow={follow} onFollow={() => startFollow(selected.id)} onFleet={() => select(null)} />
        ) : fleet.length === 0 ? (
          <View style={styles.empty}>
            <Truck size={18} color={colors.textSecondary} />
            <Text variant="bodySmall" tone="secondary" style={{ flex: 1 }}>
              Şu anda sahada aktif iş yok. Kabul edilmiş ve devam eden işlerin araçları burada canlı görünür.
            </Text>
          </View>
        ) : (
          <FlatList
            horizontal
            data={fleet}
            keyExtractor={(v) => v.id}
            showsHorizontalScrollIndicator={false}
            snapToInterval={CARD_WIDTH + spacing.sm}
            decelerationRate="fast"
            contentContainerStyle={{ gap: spacing.sm }}
            style={{ marginHorizontal: -spacing.lg }}
            ListHeaderComponent={<View style={{ width: spacing.lg - spacing.sm }} />}
            ListFooterComponent={<View style={{ width: spacing.lg - spacing.sm }} />}
            renderItem={({ item }) => {
              const stale = isStale(item.fix);
              return (
                <Pressable
                  onPress={() => (item.fix ? startFollow(item.id) : router.push(routes.job(item.jobs[0]!.id)))}
                  accessibilityRole="button"
                  accessibilityHint={item.fix ? 'Aracı haritada canlı takip eder' : 'İş detayını açar'}
                  style={styles.card}>
                  <View style={styles.cardTop}>
                    <Text variant="subheading" numberOfLines={1} style={{ flex: 1 }}>
                      {item.plate ?? item.driverName}
                    </Text>
                    <StatusBadge status={item.jobs[0]!.status} />
                  </View>
                  <Text variant="bodySmall" tone="secondary" numberOfLines={1}>
                    {item.plate ? `${item.driverName} · ` : ''}
                    {item.jobs.length > 1 ? `${item.jobs.length} iş` : item.jobs[0]!.customerName}
                  </Text>
                  <Text variant="bodySmall" tone={stale ? 'danger' : 'tertiary'}>
                    {item.fix ? `Konum ${formatRelative(item.fix.timestamp, now)}${stale ? ' · güncel değil' : ''}` : 'Konum henüz gelmedi'}
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

function VehicleCard({
  vehicle,
  stale,
  now,
  follow,
  onFollow,
  onFleet,
}: {
  vehicle: FleetVehicle;
  stale: boolean;
  now: number;
  follow: boolean;
  onFollow: () => void;
  onFleet: () => void;
}) {
  const job = vehicle.jobs[0]!;
  const speed = speedText(vehicle.fix);
  return (
    <View style={styles.detail}>
      <View style={styles.cardTop}>
        <View style={{ flex: 1 }}>
          <Text variant="heading" numberOfLines={1}>
            {vehicle.plate ?? 'Plaka atanmamış'}
          </Text>
          <Text variant="bodySmall" tone="secondary" numberOfLines={1}>
            {vehicle.driverName}
          </Text>
        </View>
        {vehicle.driverPhone ? (
          <IconButton icon={Phone} label="Şoförü ara" onPress={() => Linking.openURL(`tel:${vehicle.driverPhone}`)} size={38} />
        ) : null}
      </View>

      <Pressable onPress={() => router.push(routes.job(job.id))} accessibilityRole="link" style={styles.jobRow}>
        <View style={{ flex: 1 }}>
          <Text variant="label" numberOfLines={1}>
            {job.jobNo} · {job.customerName}
          </Text>
          <Text variant="bodySmall" tone="tertiary" numberOfLines={1}>
            {vehicle.jobs.length > 1 ? `+${vehicle.jobs.length - 1} aktif iş daha · ` : ''}
            {job.deliveryAddress}
          </Text>
        </View>
        <StatusBadge status={job.status} />
      </Pressable>

      <View style={styles.metaRow}>
        <View style={[styles.dot, { backgroundColor: !vehicle.fix ? colors.borderStrong : stale ? colors.danger : colors.ink }]} />
        <Text variant="bodySmall" tone={stale ? 'danger' : 'secondary'} style={{ flex: 1 }}>
          {vehicle.fix
            ? `Son konum ${formatRelative(vehicle.fix.timestamp, now)}${stale ? ' · konum güncel değil, şoförün bağlantısı kopmuş olabilir' : ''}`
            : 'Şoför henüz konum göndermedi'}
        </Text>
        {speed && !stale ? (
          <Text variant="label" tone="secondary">
            {speed}
          </Text>
        ) : null}
      </View>

      <View style={styles.actions}>
        {vehicle.fix ? (
          <Button
            label={follow ? 'Canlı takipte' : 'Canlı takip'}
            icon={Crosshair}
            variant={follow ? 'primary' : 'secondary'}
            size="sm"
            onPress={onFollow}
            style={{ flex: 1 }}
          />
        ) : null}
        <Button label="Tüm filo" icon={Maximize2} variant="secondary" size="sm" onPress={onFleet} style={{ flex: 1 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  empty: { flexDirection: 'row', gap: spacing.md, alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  card: { width: CARD_WIDTH, backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, gap: 6, borderWidth: 1, borderColor: colors.border },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  detail: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md, borderWidth: 1, borderColor: colors.border },
  jobRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dot: { width: 8, height: 8, borderRadius: 4 },
  actions: { flexDirection: 'row', gap: spacing.sm },
});
