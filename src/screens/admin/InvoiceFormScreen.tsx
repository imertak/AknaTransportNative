import { router, useLocalSearchParams } from 'expo-router';
import { ChevronDown, Plus, ReceiptText, Square, SquareCheck, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { InvoicePreview } from '@/components/invoices/InvoicePreview';
import { AmountBadge, JobPickerSheet, shortName } from '@/components/invoices/JobPickerSheet';
import { BottomBar, Button, Card, DateField, EmptyState, FieldShell, InfoTip, Input, LabelWithInfo, NavHeader, Screen, ScrollContent, Section, SegmentedControl, SelectField, Text, type SelectOption } from '@/components/ui';
import { APP_CONFIG } from '@/constants/config';
import { useCurrentUser } from '@/contexts/AuthContext';
import { useAsyncAction } from '@/hooks/useAsyncAction';
import { useCustomers, useInvoices, useJobs, useWithholdingTypes } from '@/hooks/useData';
import { routes } from '@/navigation/routes';
import { calculateInvoiceTotals } from '@/services';
import { invoiceActions } from '@/store';
import { colors, radius, spacing } from '@/theme';
import type { Customer, CustomerInput } from '@/types';
import { formatAmountInput, formatCurrency, formatDate, parseAmount, todayISO } from '@/utils/format';
import { composeJobText } from '@/utils/stops';
import { amountInWords, calculateWithholding, DEFAULT_WITHHOLDING_TYPES, formatIban, isValidIban, lineQuantityLabel, SINGLE_LINE_TITLE } from '@/utils/invoiceText';
import { isEmail, isPhone, isTaxNumber } from '@/utils/validation';

const NO_WITHHOLDING = 'none';

/** Fatura türü: işlerden (mevcut akış) veya iş olmadan, elle girilen kalemlerle. */
type Mode = 'jobs' | 'free';
/** Serbest faturada müşteri: kayıtlı müşterilerden seçilir veya bilgileri girilir. */
type CustomerMode = 'registered' | 'new';

const MODE_OPTIONS: SelectOption<Mode>[] = [
  { value: 'jobs', label: 'İşlerden' },
  { value: 'free', label: 'İş olmadan' },
];
const CUSTOMER_MODE_OPTIONS: SelectOption<CustomerMode>[] = [
  { value: 'registered', label: 'Kayıtlı müşteri' },
  { value: 'new', label: 'Yeni müşteri' },
];

const INFO: Record<Mode, string> = {
  jobs: 'Fatura taslak olarak oluşturulur ve resmi değildir. Aynı müşteriye ait birden fazla işi tek faturada birleştirebilirsiniz.',
  free:
    'İşe bağlı olmadan, mal/hizmetleri kendiniz girerek fatura kesersiniz. Fatura taslak olarak oluşturulur ve resmi değildir; iş dökümü yoktur. Yeni müşteri bilgileri fatura ile birlikte müşteri olarak kaydedilir.',
};

/** Elle girilen fatura kalemi (form durumu; tutarlar metin olarak tutulur). */
interface LineDraft {
  key: string;
  description: string;
  quantity: string;
  unitPrice: string;
}

const EMPTY_CUSTOMER = { companyName: '', taxNumber: '', taxOffice: '', billingAddress: '', email: '', phone: '' };
type NewCustomerDraft = typeof EMPTY_CUSTOMER;

let lineSeq = 0;
const newLine = (): LineDraft => ({ key: `line-${++lineSeq}`, description: '', quantity: '1', unitPrice: '' });

const parseQuantity = (v: string) => {
  const n = Number(v.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

interface Errors {
  jobs?: string;
  customer?: string;
  lines?: Record<string, { description?: string; quantity?: string; unitPrice?: string }>;
  newCustomer?: Partial<Record<keyof NewCustomerDraft, string>>;
  subtotal?: string;
  iban?: string;
}

export default function InvoiceFormScreen() {
  const { jobId: presetJob } = useLocalSearchParams<{ jobId?: string }>();
  const user = useCurrentUser();
  const jobs = useJobs();
  const invoices = useInvoices();
  const customers = useCustomers();
  const { run, pending } = useAsyncAction();

  /** Faturalandırılmamış ve iptal edilmemiş işler (bitmemiş işler de faturalanabilir). Bir iş iki faturaya giremez. */
  const billable = useMemo(() => {
    const invoiced = new Set(invoices.filter((i) => i.status !== 'cancelled').flatMap((i) => (i.jobIds?.length ? i.jobIds : [i.jobId])));
    return jobs.filter((j) => j.status !== 'cancelled' && j.billingStatus === 'not_invoiced' && !j.invoiceId && !invoiced.has(j.id));
  }, [jobs, invoices]);

  // Faturalanacak iş yoksa ekran doğrudan "İş olmadan" sekmesiyle açılır.
  const [mode, setMode] = useState<Mode>(() => (presetJob || billable.length > 0 ? 'jobs' : 'free'));

  // ─── İşlerden fatura ─────────────────────────────────────────────────────────
  const [selectedJobIds, setSelectedJobIds] = useState<string[]>(() => {
    const initial = billable.find((j) => j.id === presetJob);
    return initial ? [initial.id] : [];
  });

  const selectedJobs = useMemo(() => jobs.filter((j) => selectedJobIds.includes(j.id)), [jobs, selectedJobIds]);
  const selectedCustomerId = selectedJobs[0]?.customerId ?? null;
  const jobCustomer = customers.find((c) => c.id === selectedCustomerId) ?? null;

  /** Aynı müşteriye ait faturalanabilir işler. */
  const availableJobs = useMemo(() => {
    if (!selectedCustomerId) return billable;
    return billable.filter((j) => j.customerId === selectedCustomerId);
  }, [billable, selectedCustomerId]);

  // İş seçme perdesi: perde açık kalır, işler tek tek seçilir/çıkarılır.
  const [jobPickerOpen, setJobPickerOpen] = useState(false);
  const toggleJob = (id: string) => {
    setSelectedJobIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    setErrors({});
  };
  const jobsSubtotal = useMemo(() => selectedJobs.reduce((s, j) => s + j.price, 0), [selectedJobs]);
  // İşaretliyse faturaya işler tek tek yazılmaz, tek kalem "Nakliye Bedeli" yazılır. İş dökümü değişmez.
  const [singleLine, setSingleLine] = useState(false);

  // ─── İş olmadan (serbest) fatura ─────────────────────────────────────────────
  const [customerMode, setCustomerMode] = useState<CustomerMode>('registered');
  const [freeCustomerId, setFreeCustomerId] = useState<string | null>(null);
  const [newCustomer, setNewCustomer] = useState<NewCustomerDraft>(EMPTY_CUSTOMER);
  const [lines, setLines] = useState<LineDraft[]>(() => [newLine()]);

  const customerOptions = useMemo<SelectOption[]>(
    () =>
      customers.map((c) => ({
        value: c.id,
        label: c.companyName,
        description: [c.taxNumber ? `VKN ${c.taxNumber}` : null, c.email || 'E-posta yok'].filter(Boolean).join(' · '),
      })),
    [customers],
  );
  const freeCustomer: Pick<Customer, 'companyName' | 'taxOffice' | 'taxNumber' | 'billingAddress'> | null =
    customerMode === 'registered'
      ? (customers.find((c) => c.id === freeCustomerId) ?? null)
      : newCustomer.companyName.trim()
        ? { companyName: newCustomer.companyName.trim(), taxOffice: newCustomer.taxOffice.trim(), taxNumber: newCustomer.taxNumber.trim(), billingAddress: newCustomer.billingAddress.trim() }
        : null;
  const freeCustomerEmail = customerMode === 'registered' ? customers.find((c) => c.id === freeCustomerId) : null;

  const parsedLines = lines.map((l) => {
    const quantity = parseQuantity(l.quantity) ?? 0;
    const unitPrice = parseAmount(l.unitPrice) ?? 0;
    return { ...l, quantityValue: quantity, unitPriceValue: unitPrice, total: round2(quantity * round2(unitPrice)) };
  });
  const freeSubtotal = round2(parsedLines.reduce((s, l) => s + l.total, 0));

  const updateLine = (key: string, patch: Partial<LineDraft>) => setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const removeLine = (key: string) => setLines((prev) => (prev.length > 1 ? prev.filter((l) => l.key !== key) : prev));
  const setNewCustomerField = (key: keyof NewCustomerDraft, value: string) => setNewCustomer((c) => ({ ...c, [key]: value }));

  // ─── Ortak fatura bilgileri ──────────────────────────────────────────────────
  const [issueDate, setIssueDate] = useState(todayISO());
  // İşler / kalemler faturada zaten ayrı satır olarak yazılır; bu alan yalnızca isteğe bağlı fatura notudur.
  const [description, setDescription] = useState('');
  const [vatRate, setVatRate] = useState<number>(APP_CONFIG.defaultVatRate);
  const [errors, setErrors] = useState<Errors>({});

  const withholdingTypes = useWithholdingTypes().data ?? DEFAULT_WITHHOLDING_TYPES;
  const [withholdingCode, setWithholdingCode] = useState<string>(NO_WITHHOLDING);
  const withholding = withholdingTypes.find((w) => w.code === withholdingCode) ?? null;
  const withholdingOptions = useMemo<SelectOption[]>(
    () => [{ value: NO_WITHHOLDING, label: 'Tevkifat yok' }, ...withholdingTypes.map((w) => ({ value: w.code, label: `${w.code} · ${w.fraction} · ${w.name}` }))],
    [withholdingTypes],
  );
  const [iban, setIban] = useState('');

  const amount = mode === 'jobs' ? jobsSubtotal : freeSubtotal;
  const totals = calculateInvoiceTotals(amount, vatRate);
  const wh = calculateWithholding(totals.vatAmount, totals.total, vatRate > 0 ? withholding : null);

  const changeMode = (m: Mode) => {
    setMode(m);
    setErrors({});
  };

  const validate = (): Errors => {
    const e: Errors = {};
    if (mode === 'jobs') {
      if (!selectedJobIds.length) e.jobs = 'En az bir iş seçin.';
    } else {
      if (customerMode === 'registered') {
        const c = customers.find((x) => x.id === freeCustomerId);
        if (!c) e.customer = 'Müşteri seçin.';
        else if (!c.email || !isEmail(c.email)) e.customer = 'Müşterinin kayıtlı geçerli bir e-posta adresi yok. Önce müşteri kaydını güncelleyin.';
      } else {
        const n: NonNullable<Errors['newCustomer']> = {};
        if (!newCustomer.companyName.trim()) n.companyName = 'Unvanı veya adı soyadı girin.';
        if (!newCustomer.taxNumber.trim()) n.taxNumber = 'VKN veya TCKN girin.';
        else if (!isTaxNumber(newCustomer.taxNumber)) n.taxNumber = 'VKN 10, TCKN 11 haneli olmalıdır.';
        if (!newCustomer.email.trim()) n.email = 'Fatura gönderilebilmesi için e-posta girin.';
        else if (!isEmail(newCustomer.email)) n.email = 'Geçerli bir e-posta adresi girin.';
        if (newCustomer.phone.trim() && !isPhone(newCustomer.phone)) n.phone = 'Geçerli bir telefon numarası girin.';
        if (Object.keys(n).length) e.newCustomer = n;
      }
      const lineErrors: NonNullable<Errors['lines']> = {};
      for (const l of parsedLines) {
        const le: NonNullable<Errors['lines']>[string] = {};
        if (!l.description.trim()) le.description = 'Açıklama girin.';
        if (!(l.quantityValue > 0)) le.quantity = 'Miktar girin.';
        if (!(l.unitPriceValue > 0)) le.unitPrice = 'Birim fiyat girin.';
        if (Object.keys(le).length) lineErrors[l.key] = le;
      }
      if (Object.keys(lineErrors).length) e.lines = lineErrors;
    }
    if (!(amount > 0) && !e.jobs && !e.lines) e.subtotal = 'Ara toplam sıfırdan büyük olmalı.';
    if (iban.trim() && !isValidIban(iban)) e.iban = 'IBAN geçersiz.';
    return e;
  };

  const submit = async () => {
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) return;
    const common = {
      issueDate,
      description: description.trim(),
      subtotal: amount,
      vatRate,
      withholdingCode: vatRate > 0 ? (withholding?.code ?? null) : null,
      iban: iban.trim() || undefined,
    };
    const newCustomerInput: CustomerInput | undefined =
      mode === 'free' && customerMode === 'new'
        ? {
            companyName: newCustomer.companyName.trim(),
            contactName: '',
            phone: newCustomer.phone.trim(),
            email: newCustomer.email.trim(),
            extraEmails: [],
            taxOffice: newCustomer.taxOffice.trim(),
            taxNumber: newCustomer.taxNumber.trim(),
            billingAddress: newCustomer.billingAddress.trim(),
            notes: '',
          }
        : undefined;
    const inv = await run(
      () =>
        invoiceActions.createDemo(
          mode === 'jobs'
            ? { ...common, jobIds: selectedJobIds, singleLine }
            : {
                ...common,
                customerId: customerMode === 'registered' ? (freeCustomerId ?? undefined) : undefined,
                newCustomer: newCustomerInput,
                lines: parsedLines.map((l) => ({ description: l.description.trim(), quantity: l.quantityValue, unitPrice: round2(l.unitPriceValue) })),
              },
          user.id,
        ),
      { success: newCustomerInput ? 'Müşteri kaydedildi, taslak fatura oluşturuldu.' : 'Taslak fatura oluşturuldu.' },
    );
    if (inv) router.replace(routes.invoice(inv.id));
  };

  const previewCustomer = mode === 'jobs' ? jobCustomer : freeCustomer;
  const showPreview = mode === 'jobs' ? selectedJobs.length > 0 : !!freeCustomer || freeSubtotal > 0;
  const emailNote = (() => {
    if (mode === 'jobs') {
      return jobCustomer?.email
        ? `Fatura kesilince ${jobCustomer.email} adresine${jobCustomer.extraEmails.length ? ` (bilgi: ${jobCustomer.extraEmails.join(', ')})` : ''} otomatik gönderilecek.`
        : 'Müşterinin kayıtlı e-posta adresi yok.';
    }
    const email = customerMode === 'registered' ? freeCustomerEmail?.email : newCustomer.email.trim();
    return email ? `Fatura kesilince ${email} adresine otomatik gönderilecek.` : 'Fatura kesilince müşterinin e-posta adresine otomatik gönderilir.';
  })();

  const noJobs = mode === 'jobs' && billable.length === 0 && !selectedJobs.length;

  return (
    <Screen>
      <NavHeader title="Fatura oluştur" subtitle="Taslak fatura" right={<InfoTip text={INFO[mode]} label="Fatura oluşturma hakkında" size={20} color={colors.textInverse} />}>
        <SegmentedControl dark value={mode} onChange={changeMode} options={MODE_OPTIONS} />
      </NavHeader>
      <ScrollContent>
        {noJobs ? (
          <EmptyState
            icon={ReceiptText}
            title="Faturalanacak iş yok"
            description="İşlerden fatura, iptal edilmemiş ve henüz faturalanmamış işler için oluşturulabilir. İş olmadan fatura kesmek için üstten “İş olmadan” sekmesini seçin."
          />
        ) : (
          <>
            {mode === 'jobs' ? (
              <Section title="İşler">
                <Card style={styles.card}>
                  <FieldShell label="İş ekle" required={!selectedJobIds.length} error={errors.jobs}>
                    <Pressable
                      onPress={() => setJobPickerOpen(true)}
                      accessibilityRole="button"
                      accessibilityLabel="Faturalanacak işleri seçin"
                      style={({ pressed }) => [styles.pickerBox, !!errors.jobs && styles.pickerError, pressed && { backgroundColor: colors.surfaceMuted }]}>
                      <Text style={{ flex: 1 }} tone="tertiary" numberOfLines={1}>
                        {selectedCustomerId ? 'Aynı müşterinin diğer işlerini ekleyin' : 'Faturalanacak işleri seçin'}
                      </Text>
                      <ChevronDown size={18} color={colors.textTertiary} />
                    </Pressable>
                  </FieldShell>
                  <JobPickerSheet visible={jobPickerOpen} onClose={() => setJobPickerOpen(false)} jobs={availableJobs} selectedIds={selectedJobIds} onToggle={toggleJob} />
                  {selectedJobs.length > 0 && (
                    <View style={{ gap: spacing.sm }}>
                      <Text variant="label" tone="secondary">
                        {selectedJobs.length} iş seçildi · {formatCurrency(jobsSubtotal)}
                      </Text>
                      {selectedJobs.map((j) => (
                        <View key={j.id} style={styles.chip}>
                          <AmountBadge amount={j.price} />
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text variant="subheading" numberOfLines={1}>
                              {j.jobNo} · {shortName(j.customerName)}
                            </Text>
                            <Text variant="bodySmall" tone="secondary" numberOfLines={2}>
                              {formatDate(j.date)} · {composeJobText(j.routeDescription, j.description)}
                            </Text>
                          </View>
                          <Pressable onPress={() => setSelectedJobIds((prev) => prev.filter((x) => x !== j.id))} hitSlop={8} accessibilityRole="button" accessibilityLabel={`${j.jobNo} işini çıkar`}>
                            <X size={18} color={colors.textTertiary} />
                          </Pressable>
                        </View>
                      ))}
                    </View>
                  )}
                </Card>
              </Section>
            ) : (
              <>
                <Section title="Müşteri">
                  <Card style={styles.card}>
                    <SegmentedControl
                      value={customerMode}
                      onChange={(m) => {
                        setCustomerMode(m);
                        setErrors((e) => ({ ...e, customer: undefined, newCustomer: undefined }));
                      }}
                      options={CUSTOMER_MODE_OPTIONS}
                    />
                    {customerMode === 'registered' ? (
                      <SelectField
                        label="Müşteri"
                        required
                        searchable
                        options={customerOptions}
                        value={freeCustomerId}
                        onChange={(id) => {
                          setFreeCustomerId(id);
                          setErrors((e) => ({ ...e, customer: undefined }));
                        }}
                        error={errors.customer}
                        placeholder="Kayıtlı müşteri seçin"
                        sheetTitle="Müşteri seçin"
                      />
                    ) : (
                      <>
                        <Input
                          label="Unvan / ad soyad"
                          required
                          value={newCustomer.companyName}
                          onChangeText={(v) => setNewCustomerField('companyName', v)}
                          error={errors.newCustomer?.companyName}
                          placeholder="Faturadaki alıcı adı"
                        />
                        <View style={styles.row}>
                          <View style={{ flex: 1 }}>
                            <Input
                              label="VKN / TCKN"
                              required
                              keyboardType="number-pad"
                              maxLength={11}
                              value={newCustomer.taxNumber}
                              onChangeText={(v) => setNewCustomerField('taxNumber', v.replace(/\D/g, ''))}
                              error={errors.newCustomer?.taxNumber}
                              placeholder="10 veya 11 hane"
                            />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Input label="Vergi dairesi" value={newCustomer.taxOffice} onChangeText={(v) => setNewCustomerField('taxOffice', v)} placeholder="Örn. Gebze" />
                          </View>
                        </View>
                        <Input label="Adres" multiline value={newCustomer.billingAddress} onChangeText={(v) => setNewCustomerField('billingAddress', v)} placeholder="Fatura adresi" />
                        <Input
                          label="E-posta"
                          required
                          keyboardType="email-address"
                          autoCapitalize="none"
                          autoCorrect={false}
                          value={newCustomer.email}
                          onChangeText={(v) => setNewCustomerField('email', v)}
                          error={errors.newCustomer?.email}
                          placeholder="ornek@firma.com"
                        />
                        <Input
                          label="Telefon"
                          keyboardType="phone-pad"
                          value={newCustomer.phone}
                          onChangeText={(v) => setNewCustomerField('phone', v)}
                          error={errors.newCustomer?.phone}
                          placeholder="0532 000 00 00"
                          hint="Müşteri, fatura ile birlikte müşteriler listesine kaydedilir."
                        />
                      </>
                    )}
                  </Card>
                </Section>

                <Section title="Mal/Hizmetler">
                  <Card style={styles.card}>
                    {parsedLines.map((l, i) => {
                      const le = errors.lines?.[l.key];
                      return (
                        <View key={l.key} style={[styles.lineBox, i > 0 && styles.lineBorder]}>
                          <View style={styles.lineHead}>
                            <Text variant="label" tone="secondary">
                              Mal/Hizmet {i + 1}
                            </Text>
                            {lines.length > 1 ? (
                              <Pressable onPress={() => removeLine(l.key)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Mal/Hizmet ${i + 1} sil`}>
                                <X size={18} color={colors.textTertiary} />
                              </Pressable>
                            ) : null}
                          </View>
                          <Input
                            label="Açıklama"
                            required
                            value={l.description}
                            onChangeText={(v) => updateLine(l.key, { description: v })}
                            error={le?.description}
                            placeholder="Örn. Nakliye bedeli, depolama, forklift"
                          />
                          <View style={styles.row}>
                            <View style={{ flex: 1 }}>
                              <Input
                                label="Miktar"
                                required
                                keyboardType="decimal-pad"
                                value={l.quantity}
                                onChangeText={(v) => updateLine(l.key, { quantity: v.replace(/[^\d,.]/g, '') })}
                                error={le?.quantity}
                                suffix="adet"
                              />
                            </View>
                            <View style={{ flex: 1.4 }}>
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
                            </View>
                          </View>
                          {l.total > 0 ? (
                            <Text variant="bodySmall" tone="secondary" style={{ textAlign: 'right' }}>
                              Tutar: {formatCurrency(l.total, { decimals: 2 })}
                            </Text>
                          ) : null}
                        </View>
                      );
                    })}
                    <Button label="Mal/Hizmet ekle" icon={Plus} variant="secondary" size="sm" onPress={() => setLines((prev) => [...prev, newLine()])} />
                  </Card>
                </Section>
              </>
            )}

            <Section title="Fatura bilgileri">
              <Card style={styles.card}>
                {mode === 'jobs' ? (
                  <Pressable style={styles.checkRow} onPress={() => setSingleLine((v) => !v)} accessibilityRole="checkbox" accessibilityState={{ checked: singleLine }} hitSlop={6}>
                    {singleLine ? <SquareCheck size={22} color={colors.ink} /> : <Square size={22} color={colors.textTertiary} />}
                    <View style={{ flex: 1 }}>
                      <LabelWithInfo info="İşler faturaya tek tek yazılmaz, toplam tutar tek satırda kesilir. İş dökümünde işler yine ayrı ayrı yer alır.">
                        <Text variant="subheading">Tek Mal/Hizmet: {SINGLE_LINE_TITLE}</Text>
                      </LabelWithInfo>
                    </View>
                  </Pressable>
                ) : null}
                <DateField label="Fatura tarihi" required value={issueDate} onChange={setIssueDate} />
                <Input
                  label="Fatura notu (isteğe bağlı)"
                  multiline
                  value={description}
                  onChangeText={setDescription}
                  hint={
                    mode === 'free'
                      ? 'Mal/hizmetler faturaya ayrı satırlar olarak yazılır; burayı yalnızca ek not için kullanın.'
                      : singleLine
                        ? 'Fatura tek mal/hizmet satırı olarak kesilir; burayı yalnızca ek not için kullanın.'
                        : 'İşler faturaya ayrı satırlar olarak yazılır; burayı yalnızca ek not için kullanın.'
                  }
                />
                {/* Hesaplanan değer: giriş alanı değil, yeşil özet kutusu. */}
                <View style={styles.subtotalBox} accessibilityRole="summary" accessibilityLabel={`Ara toplam, KDV hariç: ${formatCurrency(amount, { decimals: 2 })}`}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text variant="label" style={{ color: colors.success }}>
                      Ara toplam (KDV hariç)
                    </Text>
                    <Text variant="caption" tone="secondary">
                      {mode === 'jobs' ? 'Seçilen işlerin fiyatlarından hesaplanır.' : 'Mal/hizmetlerin tutarlarının toplamıdır.'}
                    </Text>
                  </View>
                  <Text variant="heading" style={styles.subtotalAmount}>
                    {formatCurrency(amount, { decimals: 2 })}
                  </Text>
                </View>
                {errors.subtotal ? (
                  <Text variant="bodySmall" style={{ color: colors.danger }}>
                    {errors.subtotal}
                  </Text>
                ) : null}
                <View style={{ gap: spacing.xs + 2 }}>
                  <Text variant="label" tone="secondary">
                    KDV oranı
                  </Text>
                  <SegmentedControl value={String(vatRate)} onChange={(v) => setVatRate(Number(v))} options={APP_CONFIG.vatRates.map((r) => ({ value: String(r), label: `%${r}` }))} />
                </View>
                <SelectField
                  label="KDV tevkifatı"
                  options={withholdingOptions}
                  value={vatRate > 0 ? withholdingCode : NO_WITHHOLDING}
                  onChange={setWithholdingCode}
                  searchable
                  hint={
                    vatRate === 0
                      ? 'KDV oranı %0 olan faturada tevkifat uygulanmaz.'
                      : withholding
                        ? `KDV'nin ${withholding.fraction}'u (${formatCurrency(wh.withholdingAmount, { decimals: 2 })}) alıcı tarafından ödenir.`
                        : 'Alıcı belirlenmiş alıcıysa (kamu kurumu, büyük mükellef vb.) yük taşımacılığı için 624 · 2/10 seçin.'
                  }
                />
                <Input
                  label="IBAN"
                  value={iban}
                  onChangeText={(v) => setIban(v.toUpperCase())}
                  onBlur={() => setIban((v) => (v.trim() ? formatIban(v) : ''))}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  placeholder="TR00 0000 0000 0000 0000 0000 00"
                  error={errors.iban}
                  hint="Boş bırakılırsa firmanın kayıtlı IBAN'ı faturaya yazılır."
                />
              </Card>
            </Section>

            {showPreview ? (
              <Section title="Önizleme">
                <InvoicePreview
                  invoiceNo="TASLAK"
                  issueDate={issueDate}
                  jobNo={mode === 'jobs' ? selectedJobs.map((j) => j.jobNo).join(', ') : '—'}
                  customer={previewCustomer}
                  description={description}
                  note={description.trim() || undefined}
                  lines={
                    mode === 'free'
                      ? parsedLines.map((l) => ({
                          key: l.key,
                          title: l.description.trim() || 'Mal/Hizmet',
                          detail: '',
                          amount: l.total,
                          quantityLabel: lineQuantityLabel(l.quantityValue || 1, l.unitPriceValue),
                        }))
                      : singleLine
                        ? [{ key: 'single', title: SINGLE_LINE_TITLE, detail: '', amount }]
                        : selectedJobs.map((j) => ({
                            key: j.id,
                            title: `${j.jobNo} · ${formatDate(j.date)}`,
                            // İşin ek açıklaması faturaya yazılmaz, yalnızca dökümde yer alır.
                            detail: [j.storeName, j.routeDescription || j.description].filter(Boolean).join(' · '),
                            amount: j.price,
                          }))
                  }
                  vatRate={vatRate}
                  {...totals}
                  demo
                  withholdingLabel={withholding && vatRate > 0 ? `KDV tevkifatı ${withholding.fraction} (${withholding.code})` : undefined}
                  withholdingAmount={wh.withholdingAmount}
                  payableAmount={wh.payableAmount}
                  amountInWords={amountInWords(wh.payableAmount)}
                  iban={iban.trim() ? formatIban(iban) : "Firma IBAN'ı (sunucu ayarı)"}
                />
                <Text variant="bodySmall" tone="secondary">
                  {emailNote}
                </Text>
              </Section>
            ) : null}
          </>
        )}
      </ScrollContent>
      <BottomBar>
        <Button label="Vazgeç" variant="secondary" onPress={() => router.back()} style={{ flex: 1 }} />
        <Button label="Taslak fatura oluştur" onPress={submit} loading={pending} disabled={noJobs} style={{ flex: 2 }} />
      </BottomBar>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.lg },
  row: { flexDirection: 'row', gap: spacing.md },
  checkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  chip: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, backgroundColor: colors.surfaceMuted, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  lineBox: { gap: spacing.md },
  lineBorder: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.lg },
  pickerBox: {
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md + 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  pickerError: { borderColor: colors.danger },
  subtotalBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.successSoft,
    borderWidth: 1,
    borderColor: colors.successBorder,
  },
  subtotalAmount: { color: colors.success, fontVariant: ['tabular-nums'] },
  lineHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
