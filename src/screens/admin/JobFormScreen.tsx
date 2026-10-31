import { router, useLocalSearchParams } from 'expo-router';
import { Info, Plus } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { BottomBar, Button, Card, DateField, EmptyState, Input, NavHeader, Screen, ScrollContent, Section, SelectField, Text, type SelectOption } from '@/components/ui';
import { isClosed } from '@/constants/jobStatus';
import { VEHICLE_TYPE_LABEL, VEHICLE_TYPES } from '@/constants/vehicles';
import { useCurrentUser } from '@/contexts/AuthContext';
import { useAsyncAction } from '@/hooks/useAsyncAction';
import { useAssignableUsers, useCustomers, useJob, useJobs } from '@/hooks/useData';
import { routes } from '@/navigation/routes';
import { jobActions } from '@/store';
import { colors, hitSlop, radius, spacing } from '@/theme';
import type { JobInput, VehicleType } from '@/types';
import { formatAmountInput, formatCurrency, parseAmount, todayISO } from '@/utils/format';
import { hasErrors, required, type Errors } from '@/utils/validation';

interface FormState {
  customerId: string;
  date: string;
  storeName: string;
  vehicleType: VehicleType | '';
  pickupAddress: string;
  deliveryAddress: string;
  description: string;
  price: string;
  driverId: string;
  notes: string;
}

const NO_DRIVER = '__none';

const empty = (customerId = ''): FormState => ({
  customerId,
  date: todayISO(),
  storeName: '',
  vehicleType: '',
  pickupAddress: '',
  deliveryAddress: '',
  description: '',
  price: '',
  driverId: NO_DRIVER,
  notes: '',
});

function validate(f: FormState): Errors<FormState> {
  const e: Errors<FormState> = {};
  if (!f.customerId) e.customerId = 'Müşteri seçin.';
  if (!f.date) e.date = 'İş tarihini seçin.';
  if (!required(f.storeName)) e.storeName = 'Mağaza / firma adını girin.';
  if (!f.vehicleType) e.vehicleType = 'Araç tipini seçin.';
  if (!required(f.pickupAddress)) e.pickupAddress = 'Yükleme adresini girin.';
  if (!required(f.deliveryAddress)) e.deliveryAddress = 'Teslimat adresini girin.';
  if (!required(f.description)) e.description = 'Yapılan nakliyeyi açıklayın.';
  const price = parseAmount(f.price);
  if (price === null) e.price = 'Fiyat girin.';
  else if (price <= 0) e.price = 'Fiyat sıfırdan büyük olmalı.';
  else if (price > 10_000_000) e.price = 'Fiyat çok yüksek görünüyor.';
  return e;
}

export default function JobFormScreen() {
  const { id, customerId: presetCustomer } = useLocalSearchParams<{ id?: string; customerId?: string }>();
  const user = useCurrentUser();
  const existing = useJob(id);
  const isEdit = !!id;
  const customers = useCustomers();
  const jobs = useJobs();
  const assignable = useAssignableUsers();
  const { run, pending } = useAsyncAction();

  const [form, setForm] = useState<FormState>(() =>
    existing
      ? {
          customerId: existing.customerId,
          date: existing.date,
          storeName: existing.storeName,
          vehicleType: existing.vehicleType,
          pickupAddress: existing.pickupAddress,
          deliveryAddress: existing.deliveryAddress,
          description: existing.description,
          price: formatAmountInput(String(existing.price).replace('.', ',')),
          driverId: existing.driverId ?? NO_DRIVER,
          notes: existing.notes,
        }
      : empty(presetCustomer),
  );
  const [errors, setErrors] = useState<Errors<FormState>>({});
  const [prefillNote, setPrefillNote] = useState<string | null>(null);
  const submitted = useRef(false);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => {
      const next = { ...f, [key]: value };
      if (submitted.current) setErrors(validate(next));
      return next;
    });
  };

  /** Müşteri seçildiğinde son işinden bilgileri getirir (yalnızca boş alanlar). */
  const applyCustomer = (customerId: string) => {
    const customer = customers.find((c) => c.id === customerId);
    const last = jobs.filter((j) => j.customerId === customerId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    setForm((f) => {
      const next: FormState = { ...f, customerId };
      if (!isEdit) {
        next.storeName = f.storeName || last?.storeName || customer?.companyName || '';
        if (last) {
          next.vehicleType = f.vehicleType || last.vehicleType;
          next.pickupAddress = f.pickupAddress || last.pickupAddress;
          next.deliveryAddress = f.deliveryAddress || last.deliveryAddress;
          next.price = f.price || formatAmountInput(String(last.price));
        }
      }
      if (submitted.current) setErrors(validate(next));
      return next;
    });
    setPrefillNote(!isEdit && last ? `Bilgiler ${customer?.companyName ?? ''} müşterisinin son işinden (${last.jobNo}) getirildi. Gerekirse düzenleyin.` : null);
  };

  // Müşteri detayından gelindiyse ön doldurma uygula
  useEffect(() => {
    if (!isEdit && presetCustomer && customers.some((c) => c.id === presetCustomer)) applyCustomer(presetCustomer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const customerOptions = useMemo<SelectOption[]>(() => customers.map((c) => ({ value: c.id, label: c.companyName, description: c.contactName })), [customers]);
  const vehicleOptions = useMemo<SelectOption<VehicleType>[]>(() => VEHICLE_TYPES.map((v) => ({ value: v, label: VEHICLE_TYPE_LABEL[v] })), []);
  const driverOptions = useMemo<SelectOption[]>(
    () => [
      { value: NO_DRIVER, label: 'Şimdilik atama yapma', description: 'İş Bekliyor durumunda kalır' },
      ...assignable.map((u) => ({ value: u.id, label: u.id === user.id ? `${u.fullName} (Ben)` : u.fullName, description: u.role === 'admin' ? 'Yönetici' : 'Şoför' })),
    ],
    [assignable, user.id],
  );

  if (isEdit && !existing) {
    return (
      <Screen>
        <NavHeader title="İşi düzenle" />
        <View style={{ padding: spacing.lg }}>
          <EmptyState title="İş bulunamadı" description="Kayıt silinmiş veya erişiminiz yok." />
        </View>
      </Screen>
    );
  }

  const submit = async () => {
    submitted.current = true;
    const e = validate(form);
    setErrors(e);
    if (hasErrors(e)) return;
    const input: JobInput = {
      customerId: form.customerId,
      date: form.date,
      storeName: form.storeName.trim(),
      vehicleType: form.vehicleType as VehicleType,
      pickupAddress: form.pickupAddress.trim(),
      deliveryAddress: form.deliveryAddress.trim(),
      description: form.description.trim(),
      price: parseAmount(form.price)!,
      notes: form.notes.trim(),
      driverId: form.driverId === NO_DRIVER ? undefined : form.driverId,
    };
    const job = await run(() => (isEdit ? jobActions.update(id!, input, user.id) : jobActions.create(input, user.id)), {
      success: isEdit ? 'İş güncellendi.' : 'İş oluşturuldu.',
    });
    if (job) {
      if (isEdit) router.back();
      else router.replace(routes.job(job.id));
    }
  };

  const price = parseAmount(form.price);
  const driverLocked = !!existing && isClosed(existing.status);

  return (
    <Screen>
      <NavHeader title={isEdit ? 'İşi düzenle' : 'Yeni iş'} subtitle={existing ? existing.jobNo : 'İş numarası otomatik atanır'} />
      <ScrollContent keyboard>
        <Section title="Müşteri">
          <Card style={styles.card}>
            <SelectField label="Müşteri" required searchable options={customerOptions} value={form.customerId || null} onChange={applyCustomer} error={errors.customerId} placeholder="Müşteri seçin" />
            <Pressable onPress={() => router.push(routes.newCustomer)} hitSlop={hitSlop} style={styles.inlineLink} accessibilityRole="link">
              <Plus size={16} color={colors.text} />
              <Text variant="label">Yeni müşteri ekle</Text>
            </Pressable>
            {prefillNote ? (
              <View style={styles.note}>
                <Info size={16} color={colors.textSecondary} />
                <Text variant="bodySmall" tone="secondary" style={{ flex: 1 }}>{prefillNote}</Text>
              </View>
            ) : null}
            <Input label="Mağaza / firma adı" required value={form.storeName} onChangeText={(v) => set('storeName', v)} error={errors.storeName} placeholder="Örn. Starbucks" />
          </Card>
        </Section>

        <Section title="İş bilgileri">
          <Card style={styles.card}>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <DateField label="İş tarihi" required value={form.date} onChange={(v) => set('date', v)} error={errors.date} />
              </View>
              <View style={{ flex: 1 }}>
                <SelectField label="Araç tipi" required options={vehicleOptions} value={form.vehicleType || null} onChange={(v) => set('vehicleType', v)} error={errors.vehicleType} />
              </View>
            </View>
            <Input label="Yükleme adresi" required value={form.pickupAddress} onChangeText={(v) => set('pickupAddress', v)} error={errors.pickupAddress} placeholder="Örn. Haliç Tersane" />
            <Input label="Teslimat adresi" required value={form.deliveryAddress} onChangeText={(v) => set('deliveryAddress', v)} error={errors.deliveryAddress} placeholder="Örn. Zorlu AVM" />
            <Input
              label="Yapılan nakliyeler / iş açıklaması"
              required
              multiline
              value={form.description}
              onChangeText={(v) => set('description', v)}
              error={errors.description}
              placeholder="Örn. Haliç Tersane - Gebze TLS (+1 eleman yevmiyesi)"
            />
            <Input
              label="Fiyat"
              required
              keyboardType="decimal-pad"
              value={form.price}
              onChangeText={(v) => set('price', formatAmountInput(v))}
              error={errors.price}
              placeholder="0"
              suffix="TL"
              hint={price ? `KDV hariç ${formatCurrency(price)}` : 'KDV hariç tutar'}
            />
          </Card>
        </Section>

        <Section title="Atama">
          <Card style={styles.card}>
            {driverLocked ? (
              <Text variant="bodySmall" tone="secondary">Kapanmış işlerde şoför ataması değiştirilemez.</Text>
            ) : (
              <SelectField
                label="Atanacak şoför"
                options={driverOptions}
                value={form.driverId}
                onChange={(v) => set('driverId', v)}
                hint="Şoför seçilirse iş Atandı durumuna geçer. Kendinizi seçerek işi üstlenebilirsiniz."
              />
            )}
            <Input label="Ek açıklama" multiline value={form.notes} onChangeText={(v) => set('notes', v)} placeholder="Şoföre veya operasyona not" />
          </Card>
        </Section>
      </ScrollContent>
      <BottomBar>
        <Button label="Vazgeç" variant="secondary" onPress={() => router.back()} style={{ flex: 1 }} />
        <Button label={isEdit ? 'Kaydet' : 'İşi oluştur'} onPress={submit} loading={pending} style={{ flex: 2 }} />
      </BottomBar>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.lg },
  row: { flexDirection: 'row', gap: spacing.sm },
  inlineLink: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginTop: -spacing.xs },
  note: { flexDirection: 'row', gap: spacing.sm, backgroundColor: colors.surfaceMuted, padding: spacing.md, borderRadius: radius.md, alignItems: 'flex-start' },
});
