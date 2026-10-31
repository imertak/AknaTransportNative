import { router } from 'expo-router';
import { Plus, Truck } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { Badge, Button, Card, EmptyState, IconButton, NavHeader, Screen, SearchBar, SegmentedControl, Text } from '@/components/ui';
import { can } from '@/constants/permissions';
import { VEHICLE_TYPE_LABEL } from '@/constants/vehicles';
import { useCurrentUser } from '@/contexts/AuthContext';
import { useRefresh } from '@/hooks/useRefresh';
import { useVehicles } from '@/hooks/useData';
import { routes } from '@/navigation/routes';
import { colors, radius, spacing } from '@/theme';
import type { Vehicle } from '@/types';
import { searchKey } from '@/utils/format';

type Tab = 'active' | 'unassigned' | 'inactive';

/** Yönetici araç listesi: araç kaydı ve şoföre atama yalnızca buradan yapılır. */
export default function VehiclesScreen() {
  const user = useCurrentUser();
  const vehicles = useVehicles();
  const { refreshing, onRefresh } = useRefresh();
  const [tab, setTab] = useState<Tab>('active');
  const [query, setQuery] = useState('');
  const canManage = can(user, 'vehicles.manage');

  const data = useMemo(() => {
    const q = searchKey(query.trim());
    return vehicles.filter((v) => {
      if (tab === 'active' && !v.isActive) return false;
      if (tab === 'unassigned' && (!v.isActive || v.driverId)) return false;
      if (tab === 'inactive' && v.isActive) return false;
      return !q || searchKey(`${v.plate} ${v.brand} ${v.model} ${v.driverName ?? ''}`).includes(q);
    });
  }, [vehicles, tab, query]);

  const open = useCallback((v: Vehicle) => router.push(routes.editVehicle(v.id)), []);

  if (!canManage) {
    return (
      <Screen>
        <NavHeader title="Araçlar" />
        <View style={{ padding: spacing.lg }}>
          <EmptyState icon={Truck} title="Yetkiniz yok" description="Araç kaydı ve atamaları yalnızca yönetici yapabilir." />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <NavHeader
        title="Araçlar"
        subtitle={`${vehicles.filter((v) => v.isActive).length} aktif araç`}
        right={<IconButton icon={Plus} label="Araç ekle" tone="dark" onPress={() => router.push(routes.newVehicle)} />}>
        <View style={{ gap: spacing.md }}>
          <SearchBar value={query} onChange={setQuery} placeholder="Plaka, model veya şoför ara" dark />
          <SegmentedControl
            dark
            value={tab}
            onChange={setTab}
            options={[
              { value: 'active', label: 'Aktif' },
              { value: 'unassigned', label: 'Atanmamış' },
              { value: 'inactive', label: 'Pasif' },
            ]}
          />
        </View>
      </NavHeader>
      <FlatList
        data={data}
        keyExtractor={(v) => v.id}
        contentContainerStyle={styles.list}
        refreshing={refreshing}
        onRefresh={onRefresh}
        renderItem={({ item }) => <VehicleCard vehicle={item} onPress={open} />}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        ListEmptyComponent={
          <EmptyState
            icon={Truck}
            title={query ? 'Sonuç yok' : 'Araç yok'}
            description={tab === 'unassigned' ? 'Tüm aktif araçlar bir şoföre atanmış.' : 'Yeni araç ekleyerek başlayın.'}
            action={!query ? <Button label="Araç ekle" size="sm" icon={Plus} onPress={() => router.push(routes.newVehicle)} /> : undefined}
          />
        }
      />
    </Screen>
  );
}

function VehicleCard({ vehicle: v, onPress }: { vehicle: Vehicle; onPress: (v: Vehicle) => void }) {
  return (
    <Card onPress={() => onPress(v)} style={styles.card} accessibilityLabel={`${v.plate} aracını düzenle`}>
      <View style={styles.icon}>
        <Truck size={20} color={v.isActive ? colors.text : colors.textTertiary} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="subheading">{v.plate}</Text>
        <Text variant="bodySmall" tone="secondary" numberOfLines={1}>
          {[v.brand, v.model].filter(Boolean).join(' ') || 'Model belirtilmedi'} · {VEHICLE_TYPE_LABEL[v.type]}
        </Text>
        <Text variant="bodySmall" tone={v.driverName ? 'default' : 'tertiary'}>
          {v.driverName ? `Şoför: ${v.driverName}` : 'Şoföre atanmamış'}
        </Text>
      </View>
      <Badge label={v.isActive ? 'Aktif' : 'Pasif'} tone={v.isActive ? 'outline' : 'muted'} />
    </Card>
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.lg, paddingBottom: spacing.huge, flexGrow: 1 },
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  icon: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.surfaceSunken, alignItems: 'center', justifyContent: 'center' },
});
