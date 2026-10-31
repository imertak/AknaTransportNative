import { router, useLocalSearchParams } from 'expo-router';
import { Truck, UserRoundCog, UserRoundX } from 'lucide-react-native';
import { useMemo, useRef, useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';

import { BottomBar, Button, Card, EmptyState, InfoRow, Input, NavHeader, OptionSheet, Screen, ScrollContent, Section, SelectField, Text, type SelectOption } from '@/components/ui';
import { can } from '@/constants/permissions';
import { VEHICLE_TYPE_LABEL, VEHICLE_TYPES } from '@/constants/vehicles';
import { useCurrentUser } from '@/contexts/AuthContext';
import { useAsyncAction } from '@/hooks/useAsyncAction';
import { useAssignableUsers, useVehicle } from '@/hooks/useData';
import { vehicleActions } from '@/store';
import { colors, spacing } from '@/theme';
import type { VehicleInput, VehicleType } from '@/types';
import { confirm } from '@/utils/confirm';
import { formatDateTime } from '@/utils/format';
import { hasErrors, type Errors } from '@/utils/validation';

interface FormState {
  plate: string;
  type: VehicleType | '';
  brand: string;
  model: string;
  description: string;
  isActive: boolean;
}

const EMPTY: FormState = { plate: '', type: '', brand: '', model: '', description: '', isActive: true };

function validate(f: FormState): Errors<FormState> {
  const e: Errors<FormState> = {};
  const plate = f.plate.trim().replace(/\s+/g, ' ');
  if (!plate) e.plate = 'Plakayı girin.';
  else if (plate.length < 5 || plate.length > 20) e.plate = 'Geçerli bir plaka girin (örn. 34 ABC 123).';
  if (!f.type) e.type = 'Araç tipini seçin.';
  if (f.brand.length > 60) e.brand = 'Marka en fazla 60 karakter olabilir.';
  if (f.model.length > 60) e.model = 'Model en fazla 60 karakter olabilir.';
  return e;
}

/** Araç ekleme/düzenleme ve şoföre atama. Yalnızca yönetici kullanabilir. */
export default function VehicleFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const user = useCurrentUser();
  const existing = useVehicle(id);
  const isEdit = !!id;
  const assignable = useAssignableUsers();
  const save = useAsyncAction();
  const assignAction = useAsyncAction();
  const [assignOpen, setAssignOpen] = useState(false);
  const submitted = useRef(false);

  const [form, setForm] = useState<FormState>(() =>
    existing
      ? { plate: existing.plate, type: existing.type, brand: existing.brand, model: existing.model, description: existing.description, isActive: existing.isActive }
      : EMPTY,
  );
  const [errors, setErrors] = useState<Errors<FormState>>({});

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => {
      const next = { ...f, [key]: value };
      if (submitted.current) setErrors(validate(next));
      return next;
    });

  const typeOptions = useMemo<SelectOption<VehicleType>[]>(() => VEHICLE_TYPES.map((t) => ({ value: t, label: VEHICLE_TYPE_LABEL[t] })), []);
  const driverOptions = useMemo<SelectOption[]>(
    () => assignable.map((u) => ({ value: u.id, label: u.id === user.id ? `${u.fullName} (Ben)` : u.fullName, description: u.role === 'admin' ? 'Yönetici' : 'Şoför' })),
    [assignable, user.id],
  );

  if (!can(user, 'vehicles.manage')) {
    return (
      <Screen>
        <NavHeader title="Araç" />
        <View style={{ padding: spacing.lg }}>
          <EmptyState icon={Truck} title="Yetkiniz yok" description="Araç kaydı ve atamaları yalnızca yönetici yapabilir." />
        </View>
      </Screen>
    );
  }

  if (isEdit && !existing) {
    return (
      <Screen>
        <NavHeader title="Aracı düzenle" />
        <View style={{ padding: spacing.lg }}>
          <EmptyState icon={Truck} title="Araç bulunamadı" />
        </View>
      </Screen>
    );
  }

  const submit = async () => {
    submitted.current = true;
    const e = validate(form);
    setErrors(e);
    if (hasErrors(e)) return;
    if (isEdit && existing?.isActive && !form.isActive && existing.driverId) {
      const ok = await confirm({
        title: 'Aracı pasife al',
        message: `${existing.plate} şu anda ${existing.driverName ?? 'bir şoföre'} atanmış. Pasife alınınca atama sonlanır ve araç yeni işlere seçilemez.`,
        confirmLabel: 'Pasife al',
        destructive: true,
      });
      if (!ok) return;
    }
    const input: VehicleInput = {
      plate: form.plate.trim().replace(/\s+/g, ' ').toLocaleUpperCase('tr-TR'),
      type: form.type as VehicleType,
      brand: form.brand.trim(),
      model: form.model.trim(),
      description: form.description.trim(),
      isActive: form.isActive,
    };
    const v = await save.run(() => (isEdit ? vehicleActions.update(id!, input) : vehicleActions.create(input)), {
      success: isEdit ? 'Araç güncellendi.' : 'Araç eklendi.',
    });
    if (v) {
      if (isEdit) router.back();
      // Yeni araçta şoför ataması düzenleme ekranından yapılır.
      else router.replace({ pathname: '/admin/vehicle-form', params: { id: v.id } });
    }
  };

  const assign = async (driverId: string) => {
    if (!existing) return;
    await assignAction.run(() => vehicleActions.assign(existing.id, driverId), { success: 'Araç şoföre atandı.' });
  };

  const unassign = async () => {
    if (!existing) return;
    const ok = await confirm({ title: 'Atamayı kaldır', message: `${existing.plate} artık ${existing.driverName ?? 'şoföre'} atanmış olmayacak.`, confirmLabel: 'Kaldır', destructive: true });
    if (ok) await assignAction.run(() => vehicleActions.unassign(existing.id), { success: 'Atama kaldırıldı.' });
  };

  return (
    <Screen>
      <NavHeader title={isEdit ? 'Aracı düzenle' : 'Yeni araç'} subtitle={existing?.plate} />
      <ScrollContent keyboard>
        <Section title="Araç bilgileri">
          <Card style={styles.card}>
            <Input label="Plaka" required autoCapitalize="characters" value={form.plate} onChangeText={(v) => set('plate', v)} error={errors.plate} placeholder="34 ABC 123" />
            <SelectField label="Araç tipi" required options={typeOptions} value={form.type || null} onChange={(v) => set('type', v)} error={errors.type} />
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Input label="Marka" value={form.brand} onChangeText={(v) => set('brand', v)} error={errors.brand} placeholder="Ford" />
              </View>
              <View style={{ flex: 1 }}>
                <Input label="Model" value={form.model} onChangeText={(v) => set('model', v)} error={errors.model} placeholder="Transit" />
              </View>
            </View>
            <Input label="Açıklama" multiline value={form.description} onChangeText={(v) => set('description', v)} placeholder="Örn. soğutuculu, bakım notu" />
            {isEdit ? (
              <View style={styles.switchRow}>
                <View style={{ flex: 1 }}>
                  <Text variant="label">Aktif</Text>
                  <Text variant="bodySmall" tone="secondary">Pasif araçlar şoföre atanamaz ve işlere seçilemez.</Text>
                </View>
                <Switch
                  value={form.isActive}
                  onValueChange={(v) => set('isActive', v)}
                  trackColor={{ true: colors.ink, false: colors.borderStrong }}
                  thumbColor={colors.surface}
                  accessibilityLabel="Araç aktif"
                />
              </View>
            ) : null}
          </Card>
        </Section>

        {existing ? (
          <Section title="Şoför ataması">
            <Card style={{ gap: spacing.md }}>
              <InfoRow
                icon={UserRoundCog}
                label="Aktif şoför"
                value={existing.driverName ? `${existing.driverName}${existing.assignedAt ? ` · ${formatDateTime(existing.assignedAt)}` : ''}` : 'Atanmamış'}
                last
              />
              <Text variant="bodySmall" tone="secondary">
                Bir araç aynı anda yalnızca bir şoföre atanır. Bir şoförün birden fazla aracı olabilir. Başka şoföre vermek için önce mevcut atamayı kaldırın.
              </Text>
              {existing.isActive ? (
                existing.driverId ? (
                  <Button label="Atamayı kaldır" variant="secondary" icon={UserRoundX} onPress={unassign} loading={assignAction.pending} />
                ) : (
                  <Button label="Şoföre ata" icon={UserRoundCog} onPress={() => setAssignOpen(true)} loading={assignAction.pending} />
                )
              ) : (
                <Text variant="bodySmall" tone="danger">Pasif araç şoföre atanamaz.</Text>
              )}
            </Card>
          </Section>
        ) : (
          <Text variant="bodySmall" tone="secondary">Araç kaydedildikten sonra şoföre atayabilirsiniz.</Text>
        )}
      </ScrollContent>
      <BottomBar>
        <Button label="Vazgeç" variant="secondary" onPress={() => router.back()} style={{ flex: 1 }} />
        <Button label={isEdit ? 'Kaydet' : 'Aracı ekle'} onPress={submit} loading={save.pending} style={{ flex: 2 }} />
      </BottomBar>
      <OptionSheet visible={assignOpen} onClose={() => setAssignOpen(false)} title="Şoför seç" options={driverOptions} onSelect={assign} searchable />
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.lg },
  row: { flexDirection: 'row', gap: spacing.sm },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
});
