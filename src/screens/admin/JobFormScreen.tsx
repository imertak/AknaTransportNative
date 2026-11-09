import { router, useLocalSearchParams } from 'expo-router';
import { ArrowUp, History, Info, MapPin, MapPinCheck, Phone, Plus, X } from 'lucide-react-native';
import { useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AddressMapModal } from '@/components/map/AddressMapModal';
import {
  BottomBar,
  Button,
  Card,
  CollapsibleCard,
  DateField,
  EmptyState,
  Input,
  NavHeader,
  OptionSheet,
  Screen,
  ScrollContent,
  Section,
  SelectField,
  Text,
  type SelectOption,
} from '@/components/ui';
import { isClosed } from '@/constants/jobStatus';
import { useVehicleTypeOptions, vehicleTypeLabel } from '@/constants/vehicles';
import { useCurrentUser } from '@/contexts/AuthContext';
import { useAsyncAction } from '@/hooks/useAsyncAction';
import { useAssignableUsers, useCustomerAddresses, useCustomers, useDriverVehicles, useJob, useJobs, useVehicles } from '@/hooks/useData';
import { routes } from '@/navigation/routes';
import { jobActions } from '@/store';
import { colors, hitSlop, radius, spacing } from '@/theme';
import type { Customer, GeoPoint, JobContact, JobInput, JobStop, StopType, TransportJob, Vehicle, VehicleType } from '@/types';
import { capitalizeWords, formatAmountInput, formatCurrency, parseAmount, todayISO } from '@/utils/format';
import { STOP_TYPE_LABEL } from '@/utils/stops';
import { hasErrors, required, type Errors } from '@/utils/validation';

interface StopDraft {
  key: string;
  type: StopType;
  address: string;
  point?: GeoPoint;
}

interface ContactDraft {
  key: string;
  role: string;
  name: string;
  phone: string;
}

interface FormState {
  customerId: string;
  date: string;
  storeName: string;
  vehicleType: VehicleType | '';
  stops: StopDraft[];
  contacts: ContactDraft[];
  description: string;
  price: string;
  driverId: string;
  vehicleId: string;
  notes: string;
}

type FormErrors = Errors<FormState> & { pickups?: string; deliveries?: string; contactErrors?: Record<string, string> };

const NO_DRIVER = '__none';
const NO_VEHICLE = '__none';
const MAX_STOPS = 30;
const MAX_CONTACTS = 10;
const PHONE_RE = /^\+?[0-9 ()-]{7,20}$/;

let keySeq = 0;
const draft = (type: StopType, address = '', point?: GeoPoint): StopDraft => ({ key: `s${++keySeq}`, type, address, point });
const fromStops = (stops: JobStop[]): StopDraft[] => stops.map((s) => draft(s.type, s.address, s.point));
const contactDraft = (c?: JobContact): ContactDraft => ({ key: `c${++keySeq}`, role: c?.role ?? '', name: c?.name ?? '', phone: c?.phone ?? '' });
const fromContacts = (contacts: JobContact[]): ContactDraft[] => contacts.map(contactDraft);
const isBlankContact = (c: ContactDraft) => !c.role.trim() && !c.name.trim() && !c.phone.trim();
/** Yetkili kişi rolleri için hızlı seçenekler; serbest metin de yazılabilir. */
const CONTACT_ROLES = ['Yük sahibi', 'Teslim alan', 'Depo sorumlusu'];

const empty = (customerId = ''): FormState => ({
  customerId,
  date: todayISO(),
  storeName: '',
  vehicleType: '',
  stops: [draft('pickup'), draft('delivery')],
  contacts: [],
  description: '',
  price: '',
  driverId: NO_DRIVER,
  vehicleId: NO_VEHICLE,
  notes: '',
});

function validate(f: FormState): FormErrors {
  const e: FormErrors = {};
  if (!f.customerId) e.customerId = 'Müşteri seçin.';
  if (!f.date) e.date = 'İş tarihini seçin.';
  if (!f.vehicleType) e.vehicleType = 'Araç tipini seçin.';
  if (!f.stops.some((s) => s.type === 'pickup' && required(s.address))) e.pickups = 'En az bir yükleme noktası girin.';
  if (!f.stops.some((s) => s.type === 'delivery' && required(s.address))) e.deliveries = 'En az bir teslimat noktası girin.';
  if (f.stops.filter((s) => s.address.trim()).length > MAX_STOPS) e.pickups = `Bir işte en fazla ${MAX_STOPS} durak olabilir.`;
  const contactErrors: Record<string, string> = {};
  for (const c of f.contacts) {
    if (isBlankContact(c)) continue;
    if (!c.phone.trim()) contactErrors[c.key] = 'Telefon girin.';
    else if (!PHONE_RE.test(c.phone.trim())) contactErrors[c.key] = 'Geçerli bir telefon numarası girin.';
  }
  if (Object.keys(contactErrors).length) e.contactErrors = contactErrors;
  const price = parseAmount(f.price);
  if (price === null) e.price = 'Fiyat girin.';
  else if (price <= 0) e.price = 'Fiyat sıfırdan büyük olmalı.';
  else if (price > 10_000_000) e.price = 'Fiyat çok yüksek görünüyor.';
  return e;
}

/** Müşterinin son işinden boş alanları doldurur (yalnızca yeni işte). */
function prefill(f: FormState, customerId: string, customers: Customer[], jobs: TransportJob[], isEdit: boolean): { form: FormState; note: string | null } {
  const customer = customers.find((c) => c.id === customerId);
  const last = jobs.filter((j) => j.customerId === customerId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  const next: FormState = { ...f, customerId };
  if (!isEdit) {
    // Firma adı müşteriden gelir; mağaza adı isteğe bağlıdır, yalnızca son işten önerilir.
    next.storeName = f.storeName || last?.storeName || '';
    if (last) {
      next.vehicleType = f.vehicleType || last.vehicleType;
      if (f.stops.every((s) => !s.address.trim())) next.stops = fromStops(last.stops);
      if (f.contacts.every(isBlankContact)) next.contacts = fromContacts(last.contacts);
      next.price = f.price || formatAmountInput(String(last.price));
    }
  }
  const note = !isEdit && last ? `Bilgiler ${customer?.companyName ?? ''} müşterisinin son işinden (${last.jobNo}) getirildi. Gerekirse düzenleyin.` : null;
  return { form: next, note };
}

/** Şoför seçilince: tek aktif aracı varsa o, yoksa boş. */
function defaultVehicle(vehicles: Vehicle[], driverId: string, current: string): string {
  if (driverId === NO_DRIVER) return NO_VEHICLE;
  const own = vehicles.filter((v) => v.isActive && v.driverId === driverId);
  if (own.some((v) => v.id === current)) return current;
  return own.length === 1 ? own[0]!.id : NO_VEHICLE;
}

/** Kapalı "Yetkili kişiler" kartında görünen özet: "Yük sahibi: Ali, Teslim alan". */
const contactSummary = (contacts: { role: string; name: string }[]) =>
  contacts.map((c) => [c.role, c.name].filter((x) => x.trim()).join(': ') || 'Kişi').join(', ');

const stopInputs = (stops: StopDraft[]) => stops.map(({ type, address, point }) => ({ type, address, point }));

export default function JobFormScreen() {
  const { id, customerId: presetCustomer } = useLocalSearchParams<{ id?: string; customerId?: string }>();
  const user = useCurrentUser();
  const existing = useJob(id);
  const isEdit = !!id;
  const customers = useCustomers();
  const jobs = useJobs();
  const assignable = useAssignableUsers();
  const allVehicles = useVehicles();
  const { run, pending } = useAsyncAction();

  // Müşteri detayından gelindiyse ön doldurma ilk durumda uygulanır.
  const [initial] = useState(() =>
    !isEdit && presetCustomer && customers.some((c) => c.id === presetCustomer)
      ? prefill(empty(presetCustomer), presetCustomer, customers, jobs, false)
      : null,
  );
  const [form, setForm] = useState<FormState>(() =>
    initial
      ? initial.form
      : existing
      ? {
          customerId: existing.customerId,
          date: existing.date,
          storeName: existing.storeName,
          vehicleType: existing.vehicleType,
          stops: fromStops(existing.stops),
          contacts: fromContacts(existing.contacts),
          description: existing.description,
          price: formatAmountInput(String(existing.price).replace('.', ',')),
          driverId: existing.driverId ?? NO_DRIVER,
          vehicleId: existing.vehicleId ?? NO_VEHICLE,
          notes: existing.notes,
        }
      : empty(presetCustomer),
  );
  const [errors, setErrors] = useState<FormErrors>({});
  const [prefillNote, setPrefillNote] = useState<string | null>(initial?.note ?? null);
  const [mapStop, setMapStop] = useState<string | null>(null);
  const [historyFor, setHistoryFor] = useState<string | null>(null);
  const submitted = useRef(false);

  const history = useCustomerAddresses(form.customerId || undefined);
  const driverId = form.driverId === NO_DRIVER ? undefined : form.driverId;
  const driverVehicles = useDriverVehicles(driverId);

  const update = (fn: (f: FormState) => FormState) =>
    setForm((f) => {
      const next = fn(f);
      if (submitted.current) setErrors(validate(next));
      return next;
    });
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => update((f) => ({ ...f, [key]: value }));

  const setStop = (key: string, patch: Partial<StopDraft>) => update((f) => ({ ...f, stops: f.stops.map((s) => (s.key === key ? { ...s, ...patch } : s)) }));
  const addStop = (type: StopType) => update((f) => ({ ...f, stops: [...f.stops, draft(type)] }));
  const setContact = (key: string, patch: Partial<ContactDraft>) =>
    update((f) => ({ ...f, contacts: f.contacts.map((c) => (c.key === key ? { ...c, ...patch } : c)) }));
  const addContact = () => update((f) => ({ ...f, contacts: [...f.contacts, contactDraft()] }));
  const removeContact = (key: string) => update((f) => ({ ...f, contacts: f.contacts.filter((c) => c.key !== key) }));
  const removeStop = (key: string) => update((f) => ({ ...f, stops: f.stops.filter((s) => s.key !== key) }));
  /** Aynı türdeki bir önceki durakla yer değiştirir (sıra numarası buna göre oluşur). */
  const moveUp = (key: string) =>
    update((f) => {
      const stop = f.stops.find((s) => s.key === key);
      if (!stop) return f;
      const sameType = f.stops.filter((s) => s.type === stop.type);
      const idx = sameType.findIndex((s) => s.key === key);
      if (idx <= 0) return f;
      const prev = sameType[idx - 1]!;
      return { ...f, stops: f.stops.map((s) => (s.key === key ? prev : s.key === prev.key ? stop : s)) };
    });

  /** Müşteri seçildiğinde son işinden bilgileri getirir (yalnızca boş alanlar). */
  const applyCustomer = (customerId: string) => {
    const r = prefill(form, customerId, customers, jobs, isEdit);
    update(() => r.form);
    setPrefillNote(r.note);
  };

  const customerOptions = useMemo<SelectOption[]>(() => customers.map((c) => ({ value: c.id, label: c.companyName, description: c.contactName })), [customers]);
  const vehicleTypeOptions: SelectOption<VehicleType>[] = useVehicleTypeOptions(existing?.vehicleType);
  const driverOptions = useMemo<SelectOption[]>(
    () => [
      { value: NO_DRIVER, label: 'Şimdilik atama yapma', description: 'İş Bekliyor durumunda kalır' },
      ...assignable.map((u) => ({ value: u.id, label: u.id === user.id ? `${u.fullName} (Ben)` : u.fullName, description: u.role === 'admin' ? 'Yönetici' : 'Şoför' })),
    ],
    [assignable, user.id],
  );
  const assignedDriver = assignable.find((u) => u.id === form.driverId);
  const assignedVehicle = allVehicles.find((v) => v.id === form.vehicleId);
  const assignmentSummary = assignedDriver
    ? [assignedDriver.id === user.id ? `${assignedDriver.fullName} (Ben)` : assignedDriver.fullName, assignedVehicle?.plate].filter(Boolean).join(' · ')
    : form.driverId && form.driverId !== NO_DRIVER ? 'Şoför seçildi' : 'Atanmadı';
  const vehicleOptions = useMemo<SelectOption[]>(
    () => [
      { value: NO_VEHICLE, label: 'Araç seçme', description: 'Araç daha sonra seçilebilir' },
      ...driverVehicles.map((v) => ({ value: v.id, label: v.plate, description: `${[v.brand, v.model].filter(Boolean).join(' ')} · ${vehicleTypeLabel(v.type)}` })),
    ],
    [driverVehicles],
  );

  const historyStop = form.stops.find((s) => s.key === historyFor);
  const historyOptions = useMemo<SelectOption[]>(
    () =>
      (history.data ?? [])
        .filter((a) => !historyStop || a.type === historyStop.type)
        .map((a) => ({
          value: a.address,
          label: a.address,
          description: `${a.useCount} kez kullanıldı${a.point ? ' · konum kayıtlı' : ''}`,
        })),
    [history.data, historyStop],
  );

  const mapTarget = form.stops.find((s) => s.key === mapStop);

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
    const { contactErrors, ...fieldErrors } = e;
    if (hasErrors(fieldErrors) || contactErrors) return;
    const input: JobInput = {
      customerId: form.customerId,
      date: form.date,
      storeName: form.storeName.trim(),
      vehicleType: form.vehicleType as VehicleType,
      stops: stopInputs(form.stops).filter((s) => s.address.trim()),
      contacts: form.contacts
        .filter((c) => !isBlankContact(c))
        .map((c) => ({ role: c.role.trim() || undefined, name: c.name.trim() || undefined, phone: c.phone.trim() })),
      description: form.description.trim(),
      price: parseAmount(form.price)!,
      notes: form.notes.trim(),
      driverId,
      vehicleId: driverId && form.vehicleId !== NO_VEHICLE ? form.vehicleId : undefined,
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

  const renderGroup = (type: StopType) => {
    const list = form.stops.filter((s) => s.type === type);
    const error = type === 'pickup' ? errors.pickups : errors.deliveries;
    const hasHistory = (history.data ?? []).some((a) => a.type === type);
    return (
      <View style={{ gap: spacing.sm }}>
        <View style={styles.groupHead}>
          <Text variant="label" style={{ flex: 1 }}>
            {type === 'pickup' ? 'Yükleme noktaları' : 'Teslimat noktaları'} <Text variant="label" tone="danger">*</Text>
          </Text>
          <Pressable
            onPress={() => addStop(type)}
            hitSlop={hitSlop}
            style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.8 }]}
            accessibilityRole="button"
            accessibilityLabel={type === 'pickup' ? 'Yükleme noktası ekle' : 'Teslimat noktası ekle'}>
            <Plus size={18} color={colors.textInverse} strokeWidth={2.5} />
            <Text variant="label" tone="inverse">Ekle</Text>
          </Pressable>
        </View>
        {list.map((stop, idx) => (
          <View key={stop.key} style={styles.stopRow}>
            <View style={[styles.seq, type === 'delivery' && styles.seqDelivery]}>
              <Text variant="label" tone={type === 'delivery' ? 'inverse' : 'default'}>{idx + 1}</Text>
            </View>
            <View style={{ flex: 1, gap: spacing.xs }}>
              <Input
                value={stop.address}
                autoCapitalize="words"
                // Adres elle değişince eski koordinat geçersiz olur; harita kontrolüyle yeniden kaydedilir.
                onChangeText={(raw) => {
                  const v = capitalizeWords(raw);
                  setStop(stop.key, { address: v, point: v.trim() === stop.address.trim() ? stop.point : undefined });
                }}
                placeholder={`${STOP_TYPE_LABEL[type]} adresi`}
                accessibilityLabel={`${STOP_TYPE_LABEL[type]} ${idx + 1}`}
              />
              <View style={styles.stopActions}>
                {hasHistory ? (
                  <Pressable onPress={() => setHistoryFor(stop.key)} hitSlop={hitSlop} style={styles.inlineLink} accessibilityRole="button">
                    <History size={14} color={colors.textSecondary} />
                    <Text variant="bodySmall" tone="secondary">Geçmiş adresler</Text>
                  </Pressable>
                ) : null}
                {stop.address.trim() ? (
                  <Pressable onPress={() => setMapStop(stop.key)} hitSlop={hitSlop} style={styles.inlineLink} accessibilityRole="button">
                    {stop.point ? <MapPinCheck size={14} color={colors.text} /> : <MapPin size={14} color={colors.textSecondary} />}
                    <Text variant="bodySmall" tone={stop.point ? 'default' : 'secondary'}>{stop.point ? 'Konum kayıtlı' : 'Haritada kontrol et'}</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
            {idx > 0 ? (
              <Pressable onPress={() => moveUp(stop.key)} hitSlop={hitSlop} style={styles.iconBtn} accessibilityRole="button" accessibilityLabel="Yukarı taşı">
                <ArrowUp size={18} color={colors.textSecondary} />
              </Pressable>
            ) : null}
            {list.length > 1 ? (
              <Pressable onPress={() => removeStop(stop.key)} hitSlop={hitSlop} style={styles.iconBtn} accessibilityRole="button" accessibilityLabel="Durağı kaldır">
                <X size={18} color={colors.textTertiary} />
              </Pressable>
            ) : null}
          </View>
        ))}
        {error ? <Text variant="bodySmall" tone="danger">{error}</Text> : null}
      </View>
    );
  };

  return (
    <Screen>
      <NavHeader title={isEdit ? 'İşi düzenle' : 'Yeni iş'} subtitle={existing ? existing.jobNo : 'İş numarası otomatik atanır'} />
      <ScrollContent>
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
            <Input
              label="Mağaza adı (isteğe bağlı)"
              autoCapitalize="words"
              value={form.storeName}
              onChangeText={(v) => set('storeName', capitalizeWords(v))}
              error={errors.storeName}
              placeholder="Örn. Kadıköy Şubesi"
              hint="Firma adı müşteriden alınır. Dökümde Firma / Mağaza olarak yazılır."
            />
          </Card>
        </Section>

        <Section title="İş bilgileri">
          <Card style={styles.card}>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <DateField label="İş tarihi" required value={form.date} onChange={(v) => set('date', v)} error={errors.date} />
              </View>
              <View style={{ flex: 1 }}>
                <SelectField label="Araç tipi" required options={vehicleTypeOptions} value={form.vehicleType || null} onChange={(v) => set('vehicleType', v)} error={errors.vehicleType} />
              </View>
            </View>
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

        <Section title="Güzergah">
          <Card style={styles.card}>
            {renderGroup('pickup')}
            <View style={styles.divider} />
            {renderGroup('delivery')}
            <Input
              label="Ek açıklama"
              multiline
              value={form.description}
              autoCapitalize="words"
              onChangeText={(v) => set('description', capitalizeWords(v))}
            />
          </Card>
        </Section>

        <Section>
          <CollapsibleCard
            title="Yetkili kişiler"
            summary={form.contacts.length ? contactSummary(form.contacts) : 'Eklenmedi'}
            info="Yük sahibi, teslim alan gibi kişilerin telefonlarını ekleyin; şoför iş detayından arayabilir."
            forceOpen={!!errors.contactErrors && Object.keys(errors.contactErrors).length > 0}>
            {form.contacts.map((c, idx) => (
              <View key={c.key} style={[styles.contact, idx > 0 && styles.contactBorder]}>
                <View style={styles.contactHead}>
                  <Text variant="label">{idx + 1}. kişi</Text>
                  <Pressable onPress={() => removeContact(c.key)} hitSlop={hitSlop} accessibilityRole="button" accessibilityLabel="Kişiyi kaldır">
                    <X size={18} color={colors.textTertiary} />
                  </Pressable>
                </View>
                <Input value={c.role} autoCapitalize="words" onChangeText={(v) => setContact(c.key, { role: capitalizeWords(v) })} placeholder="Görev (ör. Yük sahibi)" accessibilityLabel={`${idx + 1}. kişi görevi`} />
                <View style={styles.roles}>
                  {CONTACT_ROLES.map((r) => (
                    <Pressable
                      key={r}
                      onPress={() => setContact(c.key, { role: r })}
                      style={[styles.roleChip, c.role === r && styles.roleChipOn]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: c.role === r }}>
                      <Text variant="bodySmall" tone={c.role === r ? 'inverse' : 'default'}>{r}</Text>
                    </Pressable>
                  ))}
                </View>
                <Input value={c.name} autoCapitalize="words" onChangeText={(v) => setContact(c.key, { name: capitalizeWords(v) })} placeholder="Ad soyad (isteğe bağlı)" accessibilityLabel={`${idx + 1}. kişi adı`} />
                <Input
                  icon={Phone}
                  value={c.phone}
                  onChangeText={(v) => setContact(c.key, { phone: v })}
                  placeholder="Telefon"
                  keyboardType="phone-pad"
                  accessibilityLabel={`${idx + 1}. kişi telefonu`}
                  error={errors.contactErrors?.[c.key]}
                />
              </View>
            ))}
            {form.contacts.length < MAX_CONTACTS ? (
              <Pressable onPress={addContact} hitSlop={hitSlop} style={styles.inlineLink} accessibilityRole="button">
                <Plus size={16} color={colors.text} />
                <Text variant="label">Yetkili kişi ekle</Text>
              </Pressable>
            ) : null}
          </CollapsibleCard>
        </Section>

        <Section>
          <CollapsibleCard title="Atama" summary={assignmentSummary}>
            {driverLocked ? (
              <Text variant="bodySmall" tone="secondary">Kapanmış işlerde şoför ve araç ataması değiştirilemez.</Text>
            ) : (
              <>
                <SelectField
                  label="Atanacak şoför"
                  options={driverOptions}
                  value={form.driverId}
                  onChange={(v) => update((f) => ({ ...f, driverId: v, vehicleId: defaultVehicle(allVehicles, v, f.vehicleId) }))}
                  hint="Şoför seçilirse iş Atandı durumuna geçer. Kendinizi seçerek işi üstlenebilirsiniz."
                />
                {driverId ? (
                  driverVehicles.length ? (
                    <SelectField
                      label="Araç"
                      options={vehicleOptions}
                      value={form.vehicleId}
                      onChange={(v) => set('vehicleId', v)}
                      hint="Yalnızca bu şoföre atanmış aktif araçlar listelenir."
                    />
                  ) : (
                    <View style={styles.note}>
                      <Info size={16} color={colors.textSecondary} />
                      <Text variant="bodySmall" tone="secondary" style={{ flex: 1 }}>
                        Bu şoföre atanmış aktif araç yok. Araç ataması Panel › Araçlar ekranından yapılır.
                      </Text>
                    </View>
                  )
                ) : null}
              </>
            )}
            <Input label="Şoföre / operasyona not" multiline autoCapitalize="words" value={form.notes} onChangeText={(v) => set('notes', capitalizeWords(v))} placeholder="Örn. mağaza 09:00'da açılıyor" />
          </CollapsibleCard>
        </Section>
      </ScrollContent>
      <BottomBar>
        <Button label="Vazgeç" variant="secondary" onPress={() => router.back()} style={{ flex: 1 }} />
        <Button label={isEdit ? 'Kaydet' : 'İşi oluştur'} onPress={submit} loading={pending} style={{ flex: 2 }} />
      </BottomBar>

      <OptionSheet
        visible={!!historyStop}
        onClose={() => setHistoryFor(null)}
        title={historyStop ? `Geçmiş ${STOP_TYPE_LABEL[historyStop.type].toLocaleLowerCase('tr-TR')} adresleri` : 'Geçmiş adresler'}
        options={historyOptions}
        value={historyStop?.address || null}
        searchable
        emptyText={history.error ?? 'Bu müşteri için kayıtlı adres yok.'}
        onSelect={(address) => {
          if (!historyStop) return;
          const match = history.data?.find((a) => a.address === address && a.type === historyStop.type);
          setStop(historyStop.key, { address, point: match?.point });
        }}
      />
      <AddressMapModal
        visible={!!mapTarget}
        address={mapTarget?.address ?? ''}
        initialPoint={mapTarget?.point}
        onClose={() => setMapStop(null)}
        onConfirm={(point) => {
          if (mapTarget) setStop(mapTarget.key, { point });
          setMapStop(null);
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.lg },
  row: { flexDirection: 'row', gap: spacing.sm },
  inlineLink: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
  groupHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.ink, borderRadius: radius.pill, paddingVertical: spacing.sm, paddingLeft: spacing.md, paddingRight: spacing.lg, minHeight: 40 },
  note: { flexDirection: 'row', gap: spacing.sm, backgroundColor: colors.surfaceMuted, padding: spacing.md, borderRadius: radius.md, alignItems: 'flex-start' },
  stopRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  stopActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
  seq: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  seqDelivery: { backgroundColor: colors.ink },
  iconBtn: { padding: spacing.xs, marginTop: 12 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  contact: { gap: spacing.sm },
  contactBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: spacing.lg },
  contactHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  roles: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  roleChip: { paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surface },
  roleChipOn: { backgroundColor: colors.ink, borderColor: colors.ink },
});
