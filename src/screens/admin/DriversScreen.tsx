import { router } from 'expo-router';
import { Plus, UsersRound } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { Avatar, Badge, Button, Card, EmptyState, IconButton, NavHeader, Screen, SearchBar, SegmentedControl, Text } from '@/components/ui';
import { can } from '@/constants/permissions';
import { useCurrentUser } from '@/contexts/AuthContext';
import { useRefresh } from '@/hooks/useRefresh';
import { useUsers, useVehicles } from '@/hooks/useData';
import { routes } from '@/navigation/routes';
import { spacing } from '@/theme';
import type { User, Vehicle } from '@/types';
import { formatPhone, searchKey } from '@/utils/format';

type Tab = 'active' | 'inactive';

/** Yönetici şoför listesi: şoför ekleme, araç atama ve şifre sıfırlama buradan yapılır. */
export default function DriversScreen() {
  const user = useCurrentUser();
  const users = useUsers();
  const vehicles = useVehicles();
  const { refreshing, onRefresh } = useRefresh();
  const [tab, setTab] = useState<Tab>('active');
  const [query, setQuery] = useState('');

  const vehiclesByDriver = useMemo(() => {
    const map = new Map<string, Vehicle[]>();
    for (const v of vehicles) {
      if (!v.isActive || !v.driverId) continue;
      map.set(v.driverId, [...(map.get(v.driverId) ?? []), v]);
    }
    return map;
  }, [vehicles]);

  const drivers = useMemo(() => users.filter((u) => u.role === 'driver'), [users]);
  const data = useMemo(() => {
    const q = searchKey(query.trim());
    return drivers.filter((d) => {
      if (tab === 'active' ? !d.isActive : d.isActive) return false;
      const plates = (vehiclesByDriver.get(d.id) ?? []).map((v) => v.plate).join(' ');
      return !q || searchKey(`${d.fullName} ${d.email} ${d.phone} ${plates}`).includes(q);
    });
  }, [drivers, tab, query, vehiclesByDriver]);

  const open = useCallback((d: User) => router.push(routes.editDriver(d.id)), []);

  if (!can(user, 'drivers.manage')) {
    return (
      <Screen>
        <NavHeader title="Şoförler" />
        <View style={{ padding: spacing.lg }}>
          <EmptyState icon={UsersRound} title="Yetkiniz yok" description="Şoför kaydı yalnızca yönetici tarafından yapılabilir." />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <NavHeader
        title="Şoförler"
        subtitle={`${drivers.filter((d) => d.isActive).length} aktif şoför`}
        right={<IconButton icon={Plus} label="Şoför ekle" tone="dark" onPress={() => router.push(routes.newDriver)} />}>
        <View style={{ gap: spacing.md }}>
          <SearchBar value={query} onChange={setQuery} placeholder="Ad, telefon veya plaka ara" dark />
          <SegmentedControl
            dark
            value={tab}
            onChange={setTab}
            options={[
              { value: 'active', label: 'Aktif' },
              { value: 'inactive', label: 'Pasif' },
            ]}
          />
        </View>
      </NavHeader>
      <FlatList
        data={data}
        keyExtractor={(d) => d.id}
        contentContainerStyle={styles.list}
        refreshing={refreshing}
        onRefresh={onRefresh}
        renderItem={({ item }) => <DriverCard driver={item} vehicles={vehiclesByDriver.get(item.id) ?? []} onPress={open} />}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        ListEmptyComponent={
          <EmptyState
            icon={UsersRound}
            title={query ? 'Sonuç yok' : tab === 'active' ? 'Henüz şoför yok' : 'Pasif şoför yok'}
            description={tab === 'active' && !query ? 'Şoför ekleyip araçlarını atayarak başlayın.' : undefined}
            action={tab === 'active' && !query ? <Button label="Şoför ekle" size="sm" icon={Plus} onPress={() => router.push(routes.newDriver)} /> : undefined}
          />
        }
      />
    </Screen>
  );
}

function DriverCard({ driver: d, vehicles, onPress }: { driver: User; vehicles: Vehicle[]; onPress: (d: User) => void }) {
  return (
    <Card onPress={() => onPress(d)} style={styles.card} accessibilityLabel={`${d.fullName} şoförünü düzenle`}>
      <Avatar name={d.fullName} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="subheading">{d.fullName}</Text>
        <Text variant="bodySmall" tone="secondary" numberOfLines={1}>
          {d.phone ? formatPhone(d.phone) : d.email}
        </Text>
        <Text variant="bodySmall" tone={vehicles.length ? 'default' : 'tertiary'} numberOfLines={1}>
          {vehicles.length ? `Araç: ${vehicles.map((v) => v.plate).join(', ')}` : 'Araç atanmamış'}
        </Text>
      </View>
      {d.isActive ? (d.mustChangePassword ? <Badge label="İlk giriş bekliyor" tone="muted" /> : null) : <Badge label="Pasif" tone="muted" />}
    </Card>
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.lg, paddingBottom: spacing.huge, flexGrow: 1 },
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
});
