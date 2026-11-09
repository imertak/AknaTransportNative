import { Check, Pencil, Plus, Tags, X } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Badge, Button, Card, EmptyState, Input, NavHeader, Screen, ScrollContent, Section, Text } from '@/components/ui';
import { can } from '@/constants/permissions';
import { useCurrentUser } from '@/contexts/AuthContext';
import { useAsyncAction } from '@/hooks/useAsyncAction';
import { useData, vehicleActions } from '@/store';
import { colors, hitSlop, spacing } from '@/theme';
import type { VehicleTypeDef } from '@/types';
import { capitalizeWords } from '@/utils/format';

/**
 * Araç tipleri: yönetici yeni tip ekler, adını değiştirir veya pasife alır. Tipler silinmez;
 * pasif tip yeni iş ve araçlarda seçilemez, eski kayıtlarda adıyla görünmeye devam eder.
 */
export default function VehicleTypesScreen() {
  const user = useCurrentUser();
  const types = useData((s) => s.vehicleTypes);
  const add = useAsyncAction();
  const [name, setName] = useState('');
  const [error, setError] = useState<string>();

  if (!can(user, 'vehicles.manage')) {
    return (
      <Screen>
        <NavHeader title="Araç tipleri" />
        <View style={{ padding: spacing.lg }}>
          <EmptyState icon={Tags} title="Yetkiniz yok" description="Araç tiplerini yalnızca yönetici düzenleyebilir." />
        </View>
      </Screen>
    );
  }

  const submit = async () => {
    const value = name.trim();
    if (!value) return setError('Araç tipi adını girin.');
    if (types.some((t) => t.name.toLocaleLowerCase('tr-TR') === value.toLocaleLowerCase('tr-TR'))) return setError('Bu adda bir araç tipi zaten var.');
    setError(undefined);
    const created = await add.run(() => vehicleActions.createType(value), { success: 'Araç tipi eklendi.' });
    if (created) setName('');
  };

  const active = types.filter((t) => t.isActive);
  const inactive = types.filter((t) => !t.isActive);

  return (
    <Screen>
      <NavHeader title="Araç tipleri" subtitle={`${active.length} aktif tip`} />
      <ScrollContent>
        <Section title="Yeni araç tipi">
          <Card style={{ gap: spacing.md }}>
            <Input
              label="Tip adı"
              autoCapitalize="words"
              value={name}
              onChangeText={(v) => {
                setName(capitalizeWords(v));
                if (error) setError(undefined);
              }}
              placeholder="Örn. Tır, Kapalı Kasa Kamyon"
              error={error}
              returnKeyType="done"
              onSubmitEditing={submit}
            />
            <Button label="Ekle" icon={Plus} onPress={submit} loading={add.pending} />
          </Card>
        </Section>

        <Section title="Aktif tipler">
          <Card padded={false}>
            {active.length === 0 ? (
              <Text variant="bodySmall" tone="tertiary" style={{ padding: spacing.lg }}>Aktif araç tipi yok.</Text>
            ) : (
              active.map((t, i) => <TypeRow key={t.id} type={t} first={i === 0} />)
            )}
          </Card>
          <Text variant="bodySmall" tone="tertiary">İş ve araç formlarında yalnızca aktif tipler seçilebilir.</Text>
        </Section>

        {inactive.length ? (
          <Section title="Pasif tipler">
            <Card padded={false}>
              {inactive.map((t, i) => (
                <TypeRow key={t.id} type={t} first={i === 0} />
              ))}
            </Card>
            <Text variant="bodySmall" tone="tertiary">Pasif tipler eski işlerde ve araçlarda adıyla görünmeye devam eder.</Text>
          </Section>
        ) : null}
      </ScrollContent>
    </Screen>
  );
}

function TypeRow({ type, first }: { type: VehicleTypeDef; first: boolean }) {
  const types = useData((s) => s.vehicleTypes);
  const save = useAsyncAction();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(type.name);
  const [error, setError] = useState<string>();

  const update = async (input: { name: string; isActive: boolean }, success: string) => {
    const ok = await save.run(() => vehicleActions.updateType(type.id, input), { success });
    if (ok) setEditing(false);
  };

  const rename = () => {
    const value = name.trim();
    if (!value) return setError('Ad boş olamaz.');
    if (types.some((t) => t.id !== type.id && t.name.toLocaleLowerCase('tr-TR') === value.toLocaleLowerCase('tr-TR'))) return setError('Bu adda bir araç tipi zaten var.');
    setError(undefined);
    if (value === type.name) return setEditing(false);
    void update({ name: value, isActive: type.isActive }, 'Araç tipi güncellendi.');
  };

  return (
    <View style={[styles.row, !first && styles.rowBorder]}>
      {editing ? (
        <View style={{ gap: spacing.sm }}>
          <Input
            value={name}
            autoFocus
            autoCapitalize="words"
            onChangeText={(v) => setName(capitalizeWords(v))}
            error={error}
            accessibilityLabel={`${type.name} yeni adı`}
            returnKeyType="done"
            onSubmitEditing={rename}
          />
          <View style={styles.actions}>
            <Button
              label="Vazgeç"
              icon={X}
              variant="secondary"
              size="sm"
              style={{ flex: 1 }}
              onPress={() => {
                setName(type.name);
                setError(undefined);
                setEditing(false);
              }}
            />
            <Button label="Kaydet" icon={Check} size="sm" style={{ flex: 1 }} loading={save.pending} onPress={rename} />
          </View>
        </View>
      ) : (
        <View style={styles.view}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="subheading" tone={type.isActive ? 'default' : 'secondary'}>{type.name}</Text>
            {type.isActive ? null : <Badge label="Pasif" tone="muted" style={{ alignSelf: 'flex-start' }} />}
          </View>
          <Pressable onPress={() => setEditing(true)} hitSlop={hitSlop} style={styles.icon} accessibilityRole="button" accessibilityLabel={`${type.name} adını değiştir`}>
            <Pencil size={18} color={colors.textSecondary} />
          </Pressable>
          <Button
            label={type.isActive ? 'Pasife al' : 'Aktif et'}
            variant={type.isActive ? 'ghost' : 'secondary'}
            size="sm"
            loading={save.pending}
            onPress={() => update({ name: type.name, isActive: !type.isActive }, type.isActive ? 'Araç tipi pasife alındı.' : 'Araç tipi aktif edildi.')}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  view: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  icon: { padding: spacing.xs },
  actions: { flexDirection: 'row', gap: spacing.sm },
});
