import { router, useLocalSearchParams } from 'expo-router';
import { FileSignature, Plus, X } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { BottomBar, Button, Card, Chip, DateField, EmptyState, ErrorState, Input, LoadingState, NavHeader, Screen, ScrollContent, Section, SegmentedControl, SelectField, Text, type SelectOption } from '@/components/ui';
import { APP_CONFIG } from '@/constants/config';
import { useVehicleTypeOptions } from '@/constants/vehicles';
import { useAsyncAction } from '@/hooks/useAsyncAction';
import { useCustomers, useRemote } from '@/hooks/useData';
import { routes } from '@/navigation/routes';
import { offerService } from '@/services/offerService';
import { customerActions } from '@/store';
import { colors, radius, spacing } from '@/theme';
import type { OfferDetail, OfferInput, TransportType } from '@/types/offers';
import { addDays, formatAmountInput, formatCurrency, parseAmount, todayISO } from '@/utils/format';
import { isEmail, isPhone } from '@/utils/validation';

type CustomerMode = 'registered' | 'new';

const CUSTOMER_MODE_OPTIONS: SelectOption<CustomerMode>[] = [
  { value: 'registered', label: 'Kayıtlı müşteri' },
  { value: 'new', label: 'Yeni müşteri' },
];
const TRANSPORT_OPTIONS: SelectOption<TransportType>[] = [
  { value: 'Full', label: 'Komple' },
  { value: 'Partial', label: 'Parsiyel' },
];
const VALIDITY_DAYS = [7, 15, 30];
/** Sık kullanılan kalemler: dokununca açıklaması dolu yeni kalem eklenir. */
const ITEM_PRESETS = ['Nakliye bedeli', 'Yükleme / boşaltma', 'Bekleme ücreti', 'Forklift / vinç', 'Sigorta'];
const MAX_ITEMS = 30;

interface LineDraft {
  key: string;
  description: string;
  unit: string;
  quantity: string;
  unitPrice: string;
}

let lineSeq = 0;
const newLine = (description = ''): LineDraft => ({ key: `line-${++lineSeq}`, description, unit: '', quantity: '1', unitPrice: '' });

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const parseQuantity = (v: string) => {
  const n = Number(v.replace(',', '.'));
  return v.trim() && Number.isFinite(n) ? n : null;
};
/** Sayıyı Türkçe giriş biçimine çevirir: 1250.5 -> "1.250,50" */
const amountText = (n: number) => (n ? formatCurrency(n, { decimals: 'auto', suffix: false }) : '');
const quantityText = (n: number) => String(n).replace('.', ',');
const opt = (v: string) => v.trim() || undefined;

interface Form {
  customerMode: CustomerMode;
  customerId: string | null;
  companyName: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  offerDate: string;
  validUntil: string;
  loadingPoint: string;
  loadingAddress: string;
  unloadingPoint: string;
  unloadingAddress: string;
  transportType: TransportType;
  vehicleType: string;
  cargoDescription: string;
  loadingDate: string | undefined;
  deliveryDate: string | undefined;
  distanceKm: string;
  discount: string;
  vatRate: number;
  paymentTerms: string;
  deliveryTerms: string;
  customerNotes: string;
  internalNotes: string;
}

const emptyForm = (): Form => {
  const today = todayISO();
  return {
    customerMode: 'registered',
    customerId: null,
    companyName: '',
    contactPerson: '',
    phone: '',
    email: '',
    address: '',
    offerDate: today,
    validUntil: addDays(today, 7),
    loadingPoint: '',
    loadingAddress: '',
    unloadingPoint: '',
    unloadingAddress: '',
    transportType: 'Full',
    vehicleType: '',
    cargoDescription: '',
    loadingDate: undefined,
    deliveryDate: undefined,
    distanceKm: '',
    discount: '',
    vatRate: APP_CONFIG.defaultVatRate,
    paymentTerms: '',
    deliveryTerms: '',
    customerNotes: '',
    internalNotes: '',
  };
};

const formFromOffer = (o: OfferDetail): Form => ({
  customerMode: 'registered',
  customerId: o.customerId,
  companyName: o.customerName,
  contactPerson: o.contactPerson ?? '',
  phone: o.customerPhone ?? '',
  email: o.customerEmail ?? '',
  address: o.customerAddress ?? '',
  offerDate: o.offerDate,
  validUntil: o.validUntil,
  loadingPoint: o.loadingPoint,
  loadingAddress: o.loadingAddress ?? '',
  unloadingPoint: o.unloadingPoint,
  unloadingAddress: o.unloadingAddress ?? '',
  transportType: o.transportType,
  vehicleType: o.vehicleType,
  cargoDescription: o.cargoDescription ?? '',
  loadingDate: o.loadingDate ?? undefined,
  deliveryDate: o.deliveryDate ?? undefined,
  distanceKm: o.distanceKm != null ? quantityText(o.distanceKm) : '',
  discount: amountText(o.discountAmount),
  vatRate: o.vatRate,
  paymentTerms: o.paymentTerms ?? '',
  deliveryTerms: o.deliveryTerms ?? '',
  customerNotes: o.customerNotes ?? '',
  internalNotes: o.internalNotes ?? '',
});

type Errors = Partial<Record<keyof Form | 'items', string>> & { lines?: Record<string, { description?: string; quantity?: string; unitPrice?: string }> };

/** Yeni teklif / teklif düzenleme. Tutarlar burada yalnızca gösterilir; kesin hesap sunucuda yapılır. */
export default function OfferFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editing = !!id;
  const remote = useRemote(id ? `offer-form-${id}` : null, () => offerService.get(id!));

  if (editing && !remote.data) {
    return (
      <Screen>
        <NavHeader title="Teklifi düzenle" />
        {remote.error ? <ErrorState message={remote.error} onRetry={remote.reload} /> : <LoadingState label="Teklif yükleniyor" />}
      </Screen>
    );
  }
  if (remote.data && !remote.data.canEdit) {
    return (
      <Screen>
        <NavHeader title={remote.data.offerNumber} />
        <View style={{ padding: spacing.lg }}>
          <EmptyState
            icon={FileSignature}
            title="Bu teklif düzenlenemez"
            description="Yalnızca taslak, beklemede veya süresi dolmuş teklifler düzenlenebilir. Kabul edilen teklifi değiştirmek için kopyalayıp yeni teklif oluşturun."
          />
        </View>
      </Screen>
    );
  }
  return <OfferForm offer={remote.data} />;
}

function OfferForm({ offer }: { offer?: OfferDetail }) {
  const customers = useCustomers();
  const { run, pending } = useAsyncAction();
  const [form, setForm] = useState<Form>(() => (offer ? formFromOffer(offer) : emptyForm()));
  const [lines, setLines] = useState<LineDraft[]>(() =>
    offer?.items.length
      ? offer.items.map((it) => ({ ...newLine(it.description), unit: it.unit ?? '', quantity: quantityText(it.quantity), unitPrice: amountText(it.unitPrice) }))
      : [newLine('Nakliye bedeli')],
  );
  const [errors, setErrors] = useState<Errors>({});
  const vehicleOptions = useVehicleTypeOptions(form.vehicleType);

  // Tek araç tipi varsa (veya yeni teklifte) ilk tip önceden seçilir.
  const didDefaultVehicle = useRef(false);
  useEffect(() => {
    if (didDefaultVehicle.current || form.vehicleType || !vehicleOptions.length) return;
    didDefaultVehicle.current = true;
    setForm((f) => ({ ...f, vehicleType: vehicleOptions[0].value }));
  }, [vehicleOptions, form.vehicleType]);

  const set = <K extends keyof Form>(key: K, value: Form[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const customerOptions = useMemo<SelectOption[]>(
    () => customers.map((c) => ({ value: c.id, label: c.companyName, description: [c.contactName, c.phone].filter(Boolean).join(' · ') || undefined })),
    [customers],
  );

  /** Kayıtlı müşteri seçilince iletişim bilgileri müşteri kaydından doldurulur (teklif için değiştirilebilir). */
  const pickCustomer = (customerId: string) => {
    const c = customers.find((x) => x.id === customerId);
    setForm((f) => ({
      ...f,
      customerId,
      companyName: c?.companyName ?? f.companyName,
      contactPerson: c?.contactName ?? '',
      phone: c?.phone ?? '',
      email: c?.email ?? '',
      address: c?.billingAddress ?? '',
    }));
    setErrors((e) => ({ ...e, customerId: undefined, companyName: undefined, phone: undefined, email: undefined }));
  };

  const changeCustomerMode = (m: CustomerMode) => {
    setForm((f) => ({ ...f, customerMode: m, customerId: m === 'new' ? null : f.customerId, ...(m === 'new' ? { companyName: '', contactPerson: '', phone: '', email: '', address: '' } : {}) }));
    setErrors({});
  };

  // ─── Fiyatlandırma (önizleme; sunucu aynı kurallarla yeniden hesaplar) ─────────
  const parsedLines = lines.map((l) => {
    const quantity = parseQuantity(l.quantity) ?? 0;
    const unitPrice = parseAmount(l.unitPrice) ?? 0;
    return { ...l, quantityValue: quantity, unitPriceValue: unitPrice, total: round2(quantity * round2(unitPrice)) };
  });
  const subTotal = round2(parsedLines.reduce((s, l) => s + l.total, 0));
  const discount = round2(parseAmount(form.discount) ?? 0);
  const net = round2(subTotal - discount);
  const vatAmount = round2((net * form.vatRate) / 100);
  const total = round2(net + vatAmount);

  const updateLine = (key: string, patch: Partial<LineDraft>) => {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
    if (errors.lines?.[key]) setErrors((e) => ({ ...e, lines: { ...e.lines, [key]: {} } }));
  };
  const removeLine = (key: string) => setLines((prev) => (prev.length > 1 ? prev.filter((l) => l.key !== key) : prev));
  const addLine = (description = '') => setLines((prev) => (prev.length < MAX_ITEMS ? [...prev, newLine(description)] : prev));

  const validityDays = Math.round((Date.parse(form.validUntil) - Date.parse(form.offerDate)) / 86_400_000);

  const validate = (): Errors => {
    const e: Errors = {};
    if (form.customerMode === 'registered' && !form.customerId) e.customerId = 'Müşteri seçin.';
    if (!form.companyName.trim()) e.companyName = 'Firma adını girin.';
    if (form.phone.trim() && !isPhone(form.phone)) e.phone = 'Geçerli bir telefon numarası girin.';
    if (form.email.trim() && !isEmail(form.email)) e.email = 'Geçerli bir e-posta adresi girin.';
    if (!form.loadingPoint.trim()) e.loadingPoint = 'Yükleme noktasını girin.';
    if (!form.unloadingPoint.trim()) e.unloadingPoint = 'Boşaltma noktasını girin.';
    if (!form.vehicleType) e.vehicleType = 'Araç tipini seçin.';
    if (form.validUntil < form.offerDate) e.validUntil = 'Geçerlilik tarihi teklif tarihinden önce olamaz.';
    if (form.loadingDate && form.deliveryDate && form.deliveryDate < form.loadingDate) e.deliveryDate = 'Teslimat tarihi yükleme tarihinden önce olamaz.';
    if (form.distanceKm.trim()) {
      const km = parseQuantity(form.distanceKm);
      if (km === null || km < 0 || km > 100_000) e.distanceKm = 'Mesafe 0 ile 100.000 km arasında olmalı.';
    }
    const lineErrors: NonNullable<Errors['lines']> = {};
    for (const l of parsedLines) {
      const le: NonNullable<Errors['lines']>[string] = {};
      if (!l.description.trim()) le.description = 'Açıklama girin.';
      if (!(l.quantityValue > 0)) le.quantity = 'Miktar girin.';
      if (parseAmount(l.unitPrice) === null || l.unitPriceValue < 0) le.unitPrice = 'Birim fiyat girin.';
      if (Object.keys(le).length) lineErrors[l.key] = le;
    }
    if (Object.keys(lineErrors).length) e.lines = lineErrors;
    if (form.discount.trim() && parseAmount(form.discount) === null) e.discount = 'Geçerli bir tutar girin.';
    else if (!e.lines && !(net > 0)) e.discount = discount > 0 ? 'İndirim ara toplamdan küçük olmalı.' : 'Teklif tutarı sıfırdan büyük olmalı.';
    return e;
  };

  const submit = async () => {
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) return;
    const km = parseQuantity(form.distanceKm);
    const input: OfferInput = {
      customerId: form.customerMode === 'registered' ? (form.customerId ?? undefined) : undefined,
      customer: {
        companyName: form.companyName.trim(),
        contactPerson: opt(form.contactPerson),
        phoneNumber: opt(form.phone),
        email: opt(form.email),
        address: opt(form.address),
      },
      offerDate: form.offerDate,
      validUntil: form.validUntil,
      loadingPoint: form.loadingPoint.trim(),
      loadingAddress: opt(form.loadingAddress),
      unloadingPoint: form.unloadingPoint.trim(),
      unloadingAddress: opt(form.unloadingAddress),
      transportType: form.transportType,
      vehicleType: form.vehicleType,
      cargoDescription: opt(form.cargoDescription),
      loadingDate: form.loadingDate,
      deliveryDate: form.deliveryDate,
      distanceKm: km ?? undefined,
      items: parsedLines.map((l) => ({ description: l.description.trim(), unit: opt(l.unit), quantity: l.quantityValue, unitPrice: round2(l.unitPriceValue) })),
      discountAmount: discount,
      vatRate: form.vatRate,
      currency: 'TRY',
      paymentTerms: opt(form.paymentTerms),
      deliveryTerms: opt(form.deliveryTerms),
      customerNotes: opt(form.customerNotes),
      internalNotes: opt(form.internalNotes),
    };
    const saved = await run(() => (offer ? offerService.update(offer.id, input) : offerService.create(input)), {
      success: offer ? 'Teklif güncellendi.' : form.customerMode === 'new' ? 'Müşteri kaydedildi, teklif oluşturuldu.' : 'Teklif oluşturuldu.',
      error: 'Teklif kaydedilemedi.',
    });
    if (!saved) return;
    // Teklifle birlikte oluşturulan müşteri müşteriler listesine de eklenir.
    if (form.customerMode === 'new') customerActions.load(saved.customerId).catch(() => {});
    if (offer) router.back();
    else router.replace(routes.offer(saved.id));
  };

  return (
    <Screen>
      <NavHeader title={offer ? 'Teklifi düzenle' : 'Yeni teklif'} subtitle={offer ? offer.offerNumber : 'Numara kaydedince verilir'} />
      <ScrollContent>
        <Section title="Müşteri">
          <Card style={styles.card}>
            {offer ? null : <SegmentedControl value={form.customerMode} onChange={changeCustomerMode} options={CUSTOMER_MODE_OPTIONS} />}
            {form.customerMode === 'registered' ? (
              <SelectField
                label="Müşteri"
                required
                searchable
                options={customerOptions}
                value={form.customerId}
                onChange={pickCustomer}
                error={errors.customerId}
                placeholder="Kayıtlı müşteri seçin"
                sheetTitle="Müşteri seçin"
                hint={form.customerId ? 'Bilgiler müşteri kaydından dolduruldu; yalnızca bu teklif için değiştirebilirsiniz.' : undefined}
              />
            ) : null}
            {form.customerMode === 'new' || form.customerId ? (
              <>
                <Input label="Firma adı" required value={form.companyName} onChangeText={(v) => set('companyName', v)} error={errors.companyName} maxLength={200} placeholder="Teklifin hitap edildiği firma" />
                <Input label="Yetkili kişi" value={form.contactPerson} onChangeText={(v) => set('contactPerson', v)} maxLength={150} autoCapitalize="words" />
                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Input label="Telefon" keyboardType="phone-pad" value={form.phone} onChangeText={(v) => set('phone', v)} error={errors.phone} maxLength={30} placeholder="0532 000 00 00" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Input label="E-posta" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} value={form.email} onChangeText={(v) => set('email', v)} error={errors.email} maxLength={200} />
                  </View>
                </View>
                <Input
                  label="Adres"
                  multiline
                  value={form.address}
                  onChangeText={(v) => set('address', v)}
                  maxLength={500}
                  hint={form.customerMode === 'new' ? 'Müşteri, teklif ile birlikte müşteriler listesine kaydedilir.' : undefined}
                />
              </>
            ) : null}
          </Card>
        </Section>

        <Section title="Taşıma bilgileri">
          <Card style={styles.card}>
            <Input label="Yükleme noktası" required value={form.loadingPoint} onChangeText={(v) => set('loadingPoint', v)} error={errors.loadingPoint} maxLength={200} placeholder="Örn. İstanbul / Tuzla" />
            <Input label="Yükleme adresi" value={form.loadingAddress} onChangeText={(v) => set('loadingAddress', v)} maxLength={500} placeholder="Açık adres (isteğe bağlı)" />
            <Input label="Boşaltma noktası" required value={form.unloadingPoint} onChangeText={(v) => set('unloadingPoint', v)} error={errors.unloadingPoint} maxLength={200} placeholder="Örn. Ankara / Sincan" />
            <Input label="Boşaltma adresi" value={form.unloadingAddress} onChangeText={(v) => set('unloadingAddress', v)} maxLength={500} placeholder="Açık adres (isteğe bağlı)" />
            <View style={{ gap: spacing.xs + 2 }}>
              <Text variant="label" tone="secondary">Taşıma türü</Text>
              <SegmentedControl value={form.transportType} onChange={(v) => set('transportType', v)} options={TRANSPORT_OPTIONS} />
            </View>
            <SelectField label="Araç tipi" required options={vehicleOptions} value={form.vehicleType || null} onChange={(v) => set('vehicleType', v)} error={errors.vehicleType} placeholder="Araç tipi seçin" />
            <Input label="Yük açıklaması" multiline value={form.cargoDescription} onChangeText={(v) => set('cargoDescription', v)} maxLength={1000} placeholder="Örn. 8 palet kuru gıda, yaklaşık 6 ton" />
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <DateField label="Yükleme tarihi" value={form.loadingDate ?? null} onChange={(v) => set('loadingDate', v)} />
              </View>
              <View style={{ flex: 1 }}>
                <DateField label="Teslimat tarihi" value={form.deliveryDate ?? null} onChange={(v) => set('deliveryDate', v)} min={form.loadingDate} error={errors.deliveryDate} />
              </View>
            </View>
            {form.loadingDate || form.deliveryDate ? (
              <Button
                label="Tarihleri temizle"
                variant="ghost"
                size="sm"
                onPress={() => setForm((f) => ({ ...f, loadingDate: undefined, deliveryDate: undefined }))}
              />
            ) : null}
            <Input label="Mesafe" keyboardType="decimal-pad" value={form.distanceKm} onChangeText={(v) => set('distanceKm', v.replace(/[^\d,.]/g, ''))} error={errors.distanceKm} suffix="km" placeholder="İsteğe bağlı" />
          </Card>
        </Section>

        <Section title="Fiyatlandırma">
          <Card style={styles.card}>
            {parsedLines.map((l, i) => {
              const le = errors.lines?.[l.key];
              return (
                <View key={l.key} style={[styles.lineBox, i > 0 && styles.lineBorder]}>
                  <View style={styles.lineHead}>
                    <Text variant="label" tone="secondary">Kalem {i + 1}</Text>
                    {lines.length > 1 ? (
                      <Pressable onPress={() => removeLine(l.key)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Kalem ${i + 1} sil`}>
                        <X size={18} color={colors.textTertiary} />
                      </Pressable>
                    ) : null}
                  </View>
                  <Input label="Açıklama" required value={l.description} onChangeText={(v) => updateLine(l.key, { description: v })} error={le?.description} maxLength={300} />
                  <View style={styles.row}>
                    <View style={{ flex: 1 }}>
                      <Input label="Miktar" required keyboardType="decimal-pad" value={l.quantity} onChangeText={(v) => updateLine(l.key, { quantity: v.replace(/[^\d,.]/g, '') })} error={le?.quantity} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Input label="Birim" value={l.unit} onChangeText={(v) => updateLine(l.key, { unit: v })} maxLength={20} placeholder="Sefer, ton…" />
                    </View>
                  </View>
                  <Input
                    label="Birim fiyat"
                    required
                    keyboardType="decimal-pad"
                    value={l.unitPrice}
                    onChangeText={(v) => updateLine(l.key, { unitPrice: formatAmountInput(v) })}
                    error={le?.unitPrice}
                    suffix="TL"
                    placeholder="KDV hariç"
                  />
                  {l.total > 0 ? (
                    <Text variant="bodySmall" tone="secondary" style={{ textAlign: 'right' }}>
                      Tutar: {formatCurrency(l.total, { decimals: 2 })}
                    </Text>
                  ) : null}
                </View>
              );
            })}
            {lines.length < MAX_ITEMS ? (
              <>
                <View style={styles.chips}>
                  {ITEM_PRESETS.filter((p) => !lines.some((l) => l.description.trim() === p)).map((p) => (
                    <Chip key={p} label={`+ ${p}`} onPress={() => addLine(p)} />
                  ))}
                </View>
                <Button label="Kalem ekle" icon={Plus} variant="secondary" size="sm" onPress={() => addLine()} />
              </>
            ) : (
              <Text variant="bodySmall" tone="tertiary">En fazla {MAX_ITEMS} kalem eklenebilir.</Text>
            )}
            <Input label="İndirim" keyboardType="decimal-pad" value={form.discount} onChangeText={(v) => set('discount', formatAmountInput(v))} error={errors.discount} suffix="TL" placeholder="0" />
            <View style={{ gap: spacing.xs + 2 }}>
              <Text variant="label" tone="secondary">KDV oranı</Text>
              <SegmentedControl
                value={String(form.vatRate)}
                onChange={(v) => set('vatRate', Number(v))}
                options={[...new Set<number>([...APP_CONFIG.vatRates, form.vatRate])].sort((a, b) => a - b).map((r) => ({ value: String(r), label: `%${r}` }))}
              />
            </View>
            <View style={styles.totals} accessibilityRole="summary">
              <TotalRow label="Ara toplam" value={subTotal} />
              {discount > 0 ? <TotalRow label="İndirim" value={-discount} /> : null}
              {discount > 0 ? <TotalRow label="İndirimli tutar" value={net} /> : null}
              <TotalRow label={`KDV (%${form.vatRate})`} value={vatAmount} />
              <View style={styles.grand}>
                <Text variant="subheading" style={{ color: colors.textInverse }}>Genel toplam</Text>
                <Text variant="heading" style={{ color: colors.textInverse, fontVariant: ['tabular-nums'] }}>{formatCurrency(total, { decimals: 2 })}</Text>
              </View>
              <Text variant="caption" tone="tertiary">Para birimi TL. Kesin tutar kaydedilirken sunucuda aynı kurallarla hesaplanır.</Text>
            </View>
          </Card>
        </Section>

        <Section title="Koşullar">
          <Card style={styles.card}>
            <DateField label="Teklif tarihi" required value={form.offerDate} onChange={(v) => setForm((f) => ({ ...f, offerDate: v, validUntil: v > f.validUntil ? addDays(v, 7) : f.validUntil }))} />
            <View style={{ gap: spacing.xs + 2 }}>
              <Text variant="label" tone="secondary">Geçerlilik süresi</Text>
              <View style={styles.chips}>
                {VALIDITY_DAYS.map((d) => (
                  <Chip key={d} label={`${d} gün`} active={validityDays === d} onPress={() => set('validUntil', addDays(form.offerDate, d))} />
                ))}
              </View>
            </View>
            <DateField label="Geçerlilik tarihi" required value={form.validUntil} onChange={(v) => set('validUntil', v)} min={form.offerDate} error={errors.validUntil} />
            <Input label="Ödeme koşulları" multiline value={form.paymentTerms} onChangeText={(v) => set('paymentTerms', v)} maxLength={2000} placeholder="Örn. Teslimattan sonra 30 gün içinde havale" />
            <Input label="Teslimat koşulları" multiline value={form.deliveryTerms} onChangeText={(v) => set('deliveryTerms', v)} maxLength={2000} placeholder="Örn. Yükleme ve boşaltma alıcıya aittir" />
            <Input label="Müşteriye not" multiline value={form.customerNotes} onChangeText={(v) => set('customerNotes', v)} maxLength={2000} hint="PDF'te açıklama olarak görünür." />
            <Input label="Özel not (iç kullanım)" multiline value={form.internalNotes} onChangeText={(v) => set('internalNotes', v)} maxLength={2000} hint="Yalnızca uygulamada görünür, PDF'e yazılmaz." />
          </Card>
        </Section>
      </ScrollContent>
      <BottomBar>
        <Button label="Vazgeç" variant="secondary" onPress={() => router.back()} style={{ flex: 1 }} />
        <Button label={offer ? 'Kaydet' : 'Teklifi oluştur'} onPress={submit} loading={pending} style={{ flex: 2 }} />
      </BottomBar>
    </Screen>
  );
}

function TotalRow({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.totalRow}>
      <Text variant="bodySmall" tone="secondary">{label}</Text>
      <Text variant="label" style={{ fontVariant: ['tabular-nums'] }}>{formatCurrency(value, { decimals: 2 })}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.lg },
  row: { flexDirection: 'row', gap: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  lineBox: { gap: spacing.md },
  lineBorder: { paddingTop: spacing.lg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderStrong },
  lineHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  totals: { gap: spacing.sm, paddingTop: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderStrong },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  grand: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.ink, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.md, marginTop: spacing.xs },
});
