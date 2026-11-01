import { router, useLocalSearchParams } from 'expo-router';
import { KeyRound, Mail, Phone, Plus, Truck, UserRound, UsersRound, X } from 'lucide-react-native';
import { useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';

import { BottomBar, Button, Card, Chip, EmptyState, Input, NavHeader, OptionSheet, Screen, ScrollContent, Section, Sheet, Text, type SelectOption } from '@/components/ui';
import { can } from '@/constants/permissions';
import { VEHICLE_TYPE_LABEL, VEHICLE_TYPES } from '@/constants/vehicles';
import { useCurrentUser } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useAsyncAction } from '@/hooks/useAsyncAction';
import { useUsers, useVehicles } from '@/hooks/useData';
import { routes } from '@/navigation/routes';
import type { UserCredentialResult } from '@/services/contracts';
import { errorMessage } from '@/services/errors';
import { userActions, vehicleActions } from '@/store';
import { colors, radius, spacing } from '@/theme';
import type { Vehicle, VehicleType } from '@/types';
import { confirm } from '@/utils/confirm';
import { hasErrors, isEmail, isPhone, type Errors } from '@/utils/validation';

interface FormState {
  fullName: string;
  email: string;
  phone: string;
  isActive: boolean;
}

/** Kaydetmede eklenecek araç: mevcut (atanmamış) bir araç ya da şoförle birlikte açılacak yeni araç. */
type PendingVehicle =
  | { kind: 'existing'; key: string; vehicle: Vehicle }
  | { kind: 'new'; key: string; plate: string; type: VehicleType; brand: string; model: string };

interface NewVehicleState {
  plate: string;
  type: VehicleType | '';
  brand: string;
  model: string;
}

const EMPTY_VEHICLE: NewVehicleState = { plate: '', type: '', brand: '', model: '' };
const normalizePlate = (v: string) => v.trim().replace(/\s+/g, ' ').toLocaleUpperCase('tr-TR');

function validate(f: FormState): Errors<FormState> {
  const e: Errors<FormState> = {};
  if (!f.fullName.trim()) e.fullName = 'Ad soyad girin.';
  else if (f.fullName.trim().length > 150) e.fullName = 'Ad soyad en fazla 150 karakter olabilir.';
  if (!f.email.trim()) e.email = 'E-posta girin. Şoför bu adresle giriş yapar.';
  else if (!isEmail(f.email)) e.email = 'Geçerli bir e-posta girin.';
  if (!f.phone.trim()) e.phone = 'Telefon girin. Geçici şifre bu numaraya SMS ile gider.';
  else if (!isPhone(f.phone)) e.phone = 'Geçerli bir telefon numarası girin (örn. 0532 123 45 67).';
  return e;
}

/** Şoför ekleme/düzenleme. Şoförü eklerken araçlarını da seçip atayabilir veya yeni araç açabilirsiniz. */
export default function DriverFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const user = useCurrentUser();
  const users = useUsers();
  const vehicles = useVehicles();
  const toast = useToast();
  const existing = useMemo(() => users.find((u) => u.id === id), [users, id]);
  const isEdit = !!id;
  const save = useAsyncAction();
  const vehicleAction = useAsyncAction();
  const resetAction = useAsyncAction();
  const submitted = useRef(false);

  const [form, setForm] = useState<FormState>(() =>
    existing ? { fullName: existing.fullName, email: existing.email, phone: existing.phone, isActive: existing.isActive } : { fullName: '', email: '', phone: '', isActive: true },
  );
  const [errors, setErrors] = useState<Errors<FormState>>({});
  const [pending, setPending] = useState<PendingVehicle[]>([]);
  const [pickOpen, setPickOpen] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [newVehicle, setNewVehicle] = useState<NewVehicleState>(EMPTY_VEHICLE);
  const [newErrors, setNewErrors] = useState<Errors<NewVehicleState>>({});
  const [credential, setCredential] = useState<UserCredentialResult | null>(null);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => {
      const next = { ...f, [key]: value };
      if (submitted.current) setErrors(validate(next));
      return next;
    });

  const assigned = useMemo(() => (id ? vehicles.filter((v) => v.isActive && v.driverId === id) : []), [vehicles, id]);
  const pickable = useMemo<SelectOption[]>(() => {
    const chosen = new Set(pending.flatMap((p) => (p.kind === 'existing' ? [p.vehicle.id] : [])));
    return vehicles
      .filter((v) => v.isActive && !v.driverId && !chosen.has(v.id))
      .map((v) => ({ value: v.id, label: v.plate, description: [VEHICLE_TYPE_LABEL[v.type], v.brand, v.model].filter(Boolean).join(' · ') }));
  }, [vehicles, pending]);

  if (!can(user, 'drivers.manage')) {
    return (
      <Screen>
        <NavHeader title="Şoför" />
        <View style={{ padding: spacing.lg }}>
          <EmptyState icon={UsersRound} title="Yetkiniz yok" description="Şoför kaydı yalnızca yönetici tarafından yapılabilir." />
        </View>
      </Screen>
    );
  }

  if (isEdit && !existing) {
    return (
      <Screen>
        <NavHeader title="Şoförü düzenle" />
        <View style={{ padding: spacing.lg }}>
          <EmptyState icon={UsersRound} title="Şoför bulunamadı" />
        </View>
      </Screen>
    );
  }

  const pickVehicle = (vehicleId: string) => {
    const v = vehicles.find((x) => x.id === vehicleId);
    if (v) setPending((p) => [...p, { kind: 'existing', key: v.id, vehicle: v }]);
    setPickOpen(false);
  };

  const addNewVehicle = () => {
    const e: Errors<NewVehicleState> = {};
    const plate = normalizePlate(newVehicle.plate);
    if (!plate) e.plate = 'Plakayı girin.';
    else if (plate.length < 5 || plate.length > 20) e.plate = 'Geçerli bir plaka girin (örn. 34 ABC 123).';
    else if (vehicles.some((v) => normalizePlate(v.plate) === plate) || pending.some((p) => p.kind === 'new' && p.plate === plate)) {
      e.plate = `${plate} plakalı araç zaten kayıtlı. Listeden seçin.`;
    }
    if (!newVehicle.type) e.type = 'Araç tipini seçin.';
    setNewErrors(e);
    if (hasErrors(e)) return;
    setPending((p) => [...p, { kind: 'new', key: `new-${plate}`, plate, type: newVehicle.type as VehicleType, brand: newVehicle.brand.trim(), model: newVehicle.model.trim() }]);
    setNewVehicle(EMPTY_VEHICLE);
    setNewOpen(false);
  };

  /** Bekleyen araçları açar/atar. Hata olursa kalanları listede bırakır ve mesajı döner. */
  const applyVehicles = async (driverId: string): Promise<string | null> => {
    const left: PendingVehicle[] = [];
    let error: string | null = null;
    for (const p of pending) {
      if (error) {
        left.push(p);
        continue;
      }
      try {
        const vehicleId =
          p.kind === 'existing'
            ? p.vehicle.id
            : (await vehicleActions.create({ plate: p.plate, type: p.type, brand: p.brand, model: p.model, description: '', isActive: true })).id;
        await vehicleActions.assign(vehicleId, driverId);
      } catch (e) {
        error = `${p.kind === 'existing' ? p.vehicle.plate : p.plate} atanamadı: ${errorMessage(e)}`;
        left.push(p);
      }
    }
    setPending(left);
    return error;
  };

  const submit = async () => {
    submitted.current = true;
    const e = validate(form);
    setErrors(e);
    if (hasErrors(e)) return;
    if (isEdit && existing?.isActive && !form.isActive) {
      const ok = await confirm({
        title: 'Şoförü pasife al',
        message: `${existing.fullName} artık giriş yapamaz ve işe atanamaz. Araç atamaları sonlanır.`,
        confirmLabel: 'Pasife al',
        destructive: true,
      });
      if (!ok) return;
    }
    const input = { fullName: form.fullName.trim(), email: form.email.trim(), phone: form.phone.trim(), role: 'driver' as const };

    if (isEdit) {
      const updated = await save.run(() => userActions.update(id!, { ...input, isActive: form.isActive }));
      if (!updated) return;
      const vehicleError = form.isActive ? await applyVehicles(id!) : null;
      if (vehicleError) toast.show(vehicleError, 'error');
      else {
        toast.show('Şoför güncellendi.', 'success');
        router.back();
      }
      return;
    }

    const result = await save.run(() => userActions.create(input));
    if (!result) return;
    const vehicleError = await applyVehicles(result.user.id);
    if (vehicleError) toast.show(`Şoför eklendi ancak ${vehicleError}`, 'error');
    if (result.temporaryPassword) {
      // SMS sağlayıcısı yok: geçici şifre yalnızca şimdi gösterilir.
      setCredential(result);
      return;
    }
    if (!vehicleError) toast.show(result.message || 'Şoför eklendi.', 'success');
    router.replace(routes.editDriver(result.user.id));
  };

  const unassign = async (v: Vehicle) => {
    const ok = await confirm({ title: 'Aracı bırak', message: `${v.plate} artık ${existing?.fullName ?? 'şoföre'} atanmış olmayacak.`, confirmLabel: 'Bırak', destructive: true });
    if (ok) await vehicleAction.run(() => vehicleActions.unassign(v.id), { success: 'Araç ataması kaldırıldı.' });
  };

  const resetPassword = async () => {
    if (!existing) return;
    const ok = await confirm({
      title: 'Şifre sıfırla',
      message: `${existing.fullName} için yeni geçici şifre üretilir ve açık oturumları kapatılır. İlk girişte şifresini değiştirmesi istenir.`,
      confirmLabel: 'Sıfırla',
    });
    if (!ok) return;
    const result = await resetAction.run(() => userActions.resetPassword(existing.id));
    if (!result) return;
    if (result.temporaryPassword) setCredential(result);
    else toast.show(result.message || 'Yeni şifre SMS ile gönderildi.', 'success');
  };

  const closeCredential = () => {
    const created = credential && !isEdit ? credential.user.id : null;
    setCredential(null);
    if (created) router.replace(routes.editDriver(created));
  };

  const canAddVehicles = !isEdit || form.isActive;

  return (
    <Screen>
      <NavHeader title={isEdit ? 'Şoförü düzenle' : 'Yeni şoför'} subtitle={existing?.fullName} />
      <ScrollContent keyboard>
        <Section title="Şoför bilgileri">
          <Card style={styles.card}>
            <Input label="Ad soyad" required icon={UserRound} value={form.fullName} onChangeText={(v) => set('fullName', v)} error={errors.fullName} autoCapitalize="words" textContentType="name" />
            <Input
              label="E-posta"
              required
              icon={Mail}
              value={form.email}
              onChangeText={(v) => set('email', v)}
              error={errors.email}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              hint="Şoför uygulamaya bu adresle giriş yapar."
            />
            <Input
              label="Telefon"
              required
              icon={Phone}
              value={form.phone}
              onChangeText={(v) => set('phone', v)}
              error={errors.phone}
              keyboardType="phone-pad"
              placeholder="0532 123 45 67"
              hint={isEdit ? undefined : 'Geçici giriş şifresi bu numaraya SMS ile gönderilir.'}
            />
            {isEdit ? (
              <View style={styles.switchRow}>
                <View style={{ flex: 1 }}>
                  <Text variant="label">Aktif</Text>
                  <Text variant="bodySmall" tone="secondary">Pasif şoför giriş yapamaz, işe ve araca atanamaz.</Text>
                </View>
                <Switch value={form.isActive} onValueChange={(v) => set('isActive', v)} trackColor={{ true: colors.ink, false: colors.borderStrong }} thumbColor={colors.surface} accessibilityLabel="Şoför aktif" />
              </View>
            ) : null}
          </Card>
        </Section>

        <Section title="Araçlar">
          <Card style={{ gap: spacing.md }}>
            {assigned.length === 0 && pending.length === 0 ? (
              <Text variant="bodySmall" tone="secondary">
                {isEdit ? 'Bu şoföre atanmış araç yok.' : 'Şoförü eklerken araçlarını da seçebilirsiniz. Araçlar kaydedince atanır.'}
              </Text>
            ) : null}
            {assigned.map((v) => (
              <VehicleRow key={v.id} plate={v.plate} detail={[VEHICLE_TYPE_LABEL[v.type], v.brand, v.model].filter(Boolean).join(' · ')} note="Atanmış" onRemove={() => unassign(v)} />
            ))}
            {pending.map((p) => (
              <VehicleRow
                key={p.key}
                plate={p.kind === 'existing' ? p.vehicle.plate : p.plate}
                detail={
                  p.kind === 'existing'
                    ? [VEHICLE_TYPE_LABEL[p.vehicle.type], p.vehicle.brand, p.vehicle.model].filter(Boolean).join(' · ')
                    : [VEHICLE_TYPE_LABEL[p.type], p.brand, p.model].filter(Boolean).join(' · ')
                }
                note={p.kind === 'new' ? 'Yeni araç · kaydedince eklenir' : 'Kaydedince atanır'}
                onRemove={() => setPending((list) => list.filter((x) => x.key !== p.key))}
              />
            ))}
            {canAddVehicles ? (
              <View style={styles.row}>
                <Button label="Mevcut araç seç" icon={Truck} variant="secondary" size="sm" style={{ flex: 1 }} onPress={() => setPickOpen(true)} disabled={!pickable.length} loading={vehicleAction.pending} />
                <Button label="Yeni araç" icon={Plus} variant="secondary" size="sm" style={{ flex: 1 }} onPress={() => setNewOpen(true)} />
              </View>
            ) : (
              <Text variant="bodySmall" tone="danger">Pasif şoföre araç atanamaz.</Text>
            )}
            {canAddVehicles && !pickable.length ? <Text variant="bodySmall" tone="tertiary">Boşta (şoföre atanmamış) aktif araç yok.</Text> : null}
          </Card>
        </Section>

        {isEdit ? (
          <Section title="Giriş">
            <Card style={{ gap: spacing.md }}>
              <Text variant="bodySmall" tone="secondary">
                {existing?.mustChangePassword ? 'Şoför henüz geçici şifresini değiştirmedi.' : 'Şoför şifresini unuttuysa yeni geçici şifre üretebilirsiniz.'}
              </Text>
              <Button label="Şifre sıfırla" icon={KeyRound} variant="secondary" onPress={resetPassword} loading={resetAction.pending} />
            </Card>
          </Section>
        ) : null}
      </ScrollContent>
      <BottomBar>
        <Button label="Vazgeç" variant="secondary" onPress={() => router.back()} style={{ flex: 1 }} />
        <Button label={isEdit ? 'Kaydet' : 'Şoförü ekle'} onPress={submit} loading={save.pending} style={{ flex: 2 }} />
      </BottomBar>

      <OptionSheet visible={pickOpen} onClose={() => setPickOpen(false)} title="Araç seç" options={pickable} onSelect={pickVehicle} searchable emptyText="Boşta araç yok." />

      <Sheet
        visible={newOpen}
        onClose={() => setNewOpen(false)}
        title="Yeni araç"
        subtitle="Şoförle birlikte kaydedilir ve ona atanır."
        footer={<Button label="Ekle" onPress={addNewVehicle} fullWidth />}>
        <ScrollView contentContainerStyle={styles.sheetBody} keyboardShouldPersistTaps="handled">
          <Input label="Plaka" required autoCapitalize="characters" value={newVehicle.plate} onChangeText={(v) => setNewVehicle((s) => ({ ...s, plate: v }))} error={newErrors.plate} placeholder="34 ABC 123" />
          {/* Sayfa üstü bir sheet içinde ikinci bir seçim penceresi açmamak için tipler doğrudan seçilir. */}
          <View style={{ gap: spacing.xs + 2 }}>
            <Text variant="label" tone="secondary">Araç tipi *</Text>
            <View style={styles.chips} accessibilityRole="radiogroup">
              {VEHICLE_TYPES.map((t) => (
                <Chip key={t} label={VEHICLE_TYPE_LABEL[t]} active={newVehicle.type === t} onPress={() => setNewVehicle((s) => ({ ...s, type: t }))} />
              ))}
            </View>
            {newErrors.type ? <Text variant="bodySmall" tone="danger">{newErrors.type}</Text> : null}
          </View>
          <Text variant="bodySmall" tone="tertiary">Marka, model ve açıklamayı sonra Araçlar ekranından ekleyebilirsiniz.</Text>
        </ScrollView>
      </Sheet>

      <Sheet
        visible={!!credential}
        onClose={closeCredential}
        title="Geçici şifre"
        subtitle="SMS gönderilemedi. Bu şifre yalnızca şimdi gösterilir; şoföre siz iletin."
        footer={<Button label="Tamam" onPress={closeCredential} fullWidth />}>
        <View style={[styles.password, { marginHorizontal: spacing.xl }]}>
          <Text variant="caption" tone="tertiary">{credential?.user.email}</Text>
          <Text variant="title" selectable accessibilityLabel={`Geçici şifre ${credential?.temporaryPassword ?? ''}`}>
            {credential?.temporaryPassword}
          </Text>
          <Text variant="bodySmall" tone="secondary">Şoför ilk girişte yeni şifre belirler.</Text>
        </View>
      </Sheet>
    </Screen>
  );
}

function VehicleRow({ plate, detail, note, onRemove }: { plate: string; detail: string; note: string; onRemove: () => void }) {
  return (
    <View style={styles.vehicle}>
      <Truck size={18} color={colors.text} />
      <View style={{ flex: 1, gap: 1 }}>
        <Text variant="subheading">{plate}</Text>
        <Text variant="bodySmall" tone="secondary" numberOfLines={1}>{detail}</Text>
        <Text variant="caption" tone="tertiary">{note}</Text>
      </View>
      <Pressable onPress={onRemove} hitSlop={8} accessibilityRole="button" accessibilityLabel={`${plate} aracını kaldır`} style={({ pressed }) => [styles.remove, pressed && { opacity: 0.6 }]}>
        <X size={18} color={colors.textSecondary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.lg },
  row: { flexDirection: 'row', gap: spacing.sm },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  vehicle: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceSunken },
  remove: { padding: spacing.xs },
  sheetBody: { gap: spacing.lg, paddingHorizontal: spacing.xl, paddingBottom: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  password: { gap: spacing.sm, padding: spacing.lg, borderRadius: radius.md, backgroundColor: colors.surfaceSunken },
});
