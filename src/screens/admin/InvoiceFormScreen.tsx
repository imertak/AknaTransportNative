import { router, useLocalSearchParams } from 'expo-router';
import { Info, ReceiptText, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { InvoicePreview } from '@/components/invoices/InvoicePreview';
import { BottomBar, Button, Card, DateField, EmptyState, Input, NavHeader, Screen, ScrollContent, Section, SegmentedControl, SelectField, Text, type SelectOption } from '@/components/ui';
import { APP_CONFIG } from '@/constants/config';
import { useCurrentUser } from '@/contexts/AuthContext';
import { useAsyncAction } from '@/hooks/useAsyncAction';
import { useCustomers, useInvoices, useJobs, useWithholdingTypes } from '@/hooks/useData';
import { routes } from '@/navigation/routes';
import { calculateInvoiceTotals } from '@/services';
import { invoiceActions } from '@/store';
import { colors, radius, spacing } from '@/theme';
import { formatAmountInput, formatCurrency, formatDate, parseAmount, todayISO } from '@/utils/format';
import { composeJobText } from '@/utils/stops';
import { amountInWords, calculateWithholding, DEFAULT_WITHHOLDING_TYPES, formatIban, isValidIban } from '@/utils/invoiceText';

const NO_WITHHOLDING = 'none';

const apiMode = APP_CONFIG.dataSource === 'api';

export default function InvoiceFormScreen() {
  const { jobId: presetJob } = useLocalSearchParams<{ jobId?: string }>();
  const user = useCurrentUser();
  const jobs = useJobs();
  const invoices = useInvoices();
  const customers = useCustomers();
  const { run, pending } = useAsyncAction();

  /** Faturalandırılmamış, tamamlanmış (iptal edilmemiş) işler. Bir iş iki faturaya giremez. */
  const billable = useMemo(() => {
    const invoiced = new Set(invoices.filter((i) => i.status !== 'cancelled').flatMap((i) => (i.jobIds?.length ? i.jobIds : [i.jobId])));
    return jobs.filter((j) => j.status === 'completed' && j.billingStatus === 'not_invoiced' && !j.invoiceId && !invoiced.has(j.id));
  }, [jobs, invoices]);

  const [selectedJobIds, setSelectedJobIds] = useState<string[]>(() => {
    const initial = billable.find(j => j.id === presetJob);
    return initial ? [initial.id] : [];
  });

  const selectedJobs = useMemo(() => jobs.filter(j => selectedJobIds.includes(j.id)), [jobs, selectedJobIds]);
  const selectedCustomerId = selectedJobs[0]?.customerId ?? null;
  const customer = customers.find(c => c.id === selectedCustomerId) ?? null;

  /** Aynı müşteriye ait faturalanabilir işler. */
  const availableJobs = useMemo(() => {
    if (!selectedCustomerId) return billable;
    return billable.filter(j => j.customerId === selectedCustomerId);
  }, [billable, selectedCustomerId]);

  const [issueDate, setIssueDate] = useState(todayISO());
  const autoDescription = useMemo(() => selectedJobs.map((j) => composeJobText(j.routeDescription, j.description)).join(' + '), [selectedJobs]);
  const [description, setDescription] = useState('');
  const displayDescription = description || autoDescription || '';

  const autoSubtotal = useMemo(() => selectedJobs.reduce((s, j) => s + j.price, 0), [selectedJobs]);
  const [subtotalOverride, setSubtotalOverride] = useState('');
  // API modunda ara toplam sunucuda işlerin fiyatından hesaplanır; elle değiştirilemez.
  const amount = !apiMode && subtotalOverride ? (parseAmount(subtotalOverride) ?? 0) : autoSubtotal;

  const [vatRate, setVatRate] = useState<number>(APP_CONFIG.defaultVatRate);
  const [errors, setErrors] = useState<{ jobs?: string; description?: string; subtotal?: string; iban?: string }>({});

  const withholdingTypes = useWithholdingTypes().data ?? DEFAULT_WITHHOLDING_TYPES;
  const [withholdingCode, setWithholdingCode] = useState<string>(NO_WITHHOLDING);
  const withholding = withholdingTypes.find((w) => w.code === withholdingCode) ?? null;
  const withholdingOptions = useMemo<SelectOption[]>(
    () => [
      { value: NO_WITHHOLDING, label: 'Tevkifat yok' },
      ...withholdingTypes.map((w) => ({ value: w.code, label: `${w.code} · ${w.fraction} · ${w.name}` })),
    ],
    [withholdingTypes],
  );
  const [iban, setIban] = useState('');

  const jobOptions = useMemo<SelectOption[]>(
    () => availableJobs.filter(j => !selectedJobIds.includes(j.id)).map((j) => ({
      value: j.id,
      label: `${j.jobNo} · ${j.customerName}`,
      description: `${formatDate(j.date)} · ${formatCurrency(j.price)} · ${composeJobText(j.routeDescription, j.description)}`,
    })),
    [availableJobs, selectedJobIds],
  );

  const totals = calculateInvoiceTotals(amount, vatRate);
  const wh = calculateWithholding(totals.vatAmount, totals.total, vatRate > 0 ? withholding : null);

  const addJob = (id: string) => {
    setSelectedJobIds(prev => [...prev, id]);
    setErrors({});
  };

  const removeJob = (id: string) => {
    setSelectedJobIds(prev => prev.filter(x => x !== id));
  };

  const submit = async () => {
    const e: typeof errors = {};
    if (!selectedJobIds.length) e.jobs = 'En az bir iş seçin.';
    const desc = displayDescription.trim();
    if (!desc) e.description = 'Açıklama girin.';
    if (!(amount > 0)) e.subtotal = 'Ara toplam sıfırdan büyük olmalı.';
    if (iban.trim() && !isValidIban(iban)) e.iban = 'IBAN geçersiz.';
    setErrors(e);
    if (Object.keys(e).length) return;
    const inv = await run(
      () => invoiceActions.createDemo({
        jobIds: selectedJobIds,
        issueDate,
        description: desc,
        subtotal: amount,
        vatRate,
        withholdingCode: vatRate > 0 ? withholding?.code ?? null : null,
        iban: iban.trim() || undefined,
      }, user.id),
      { success: apiMode ? 'Taslak fatura oluşturuldu.' : 'Demo fatura oluşturuldu.' },
    );
    if (inv) router.replace(routes.invoice(inv.id));
  };

  if (billable.length === 0 && !selectedJobs.length) {
    return (
      <Screen>
        <NavHeader title="Fatura oluştur" />
        <View style={{ padding: spacing.lg }}>
          <EmptyState icon={ReceiptText} title="Faturalanacak iş yok" description="Fatura yalnızca tamamlanmış ve henüz faturalanmamış işler için oluşturulabilir." />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <NavHeader title="Fatura oluştur" subtitle={apiMode ? 'Taslak fatura' : 'Demo fatura'} />
      <ScrollContent keyboard>
        <View style={styles.notice}>
          <Info size={18} color={colors.text} />
          <Text variant="bodySmall" style={{ flex: 1 }}>
            {apiMode
              ? 'Fatura taslak olarak oluşturulur ve resmi değildir. Aynı müşteriye ait birden fazla işi tek faturada birleştirebilirsiniz.'
              : 'Aynı müşteriye ait birden fazla tamamlanmış işi seçerek tek fatura oluşturabilirsiniz. Demo faturalar resmi değildir.'}
          </Text>
        </View>

        <Section title="İşler">
          <Card style={styles.card}>
            <SelectField
              label="İş ekle"
              required={!selectedJobIds.length}
              searchable
              options={jobOptions}
              value={null}
              onChange={addJob}
              error={errors.jobs}
              placeholder={selectedCustomerId ? 'Aynı müşterinin diğer işlerini ekleyin' : 'Tamamlanan iş seçin'}
            />
            {selectedJobs.length > 0 && (
              <View style={{ gap: spacing.sm }}>
                <Text variant="label" tone="secondary">{selectedJobs.length} iş seçildi · {formatCurrency(autoSubtotal)}</Text>
                {selectedJobs.map(j => (
                  <View key={j.id} style={styles.jobChip}>
                    <View style={{ flex: 1 }}>
                      <Text variant="subheading">{j.jobNo} · {j.customerName}</Text>
                      <Text variant="bodySmall" tone="secondary">{formatDate(j.date)} · {formatCurrency(j.price)} · {composeJobText(j.routeDescription, j.description)}</Text>
                    </View>
                    <Pressable onPress={() => removeJob(j.id)} hitSlop={8}>
                      <X size={18} color={colors.textTertiary} />
                    </Pressable>
                  </View>
                ))}
              </View>
            )}
          </Card>
        </Section>

        <Section title="Fatura bilgileri">
          <Card style={styles.card}>
            <DateField label="Fatura tarihi" required value={issueDate} onChange={setIssueDate} />
            <Input label="Açıklama" required multiline value={displayDescription} onChangeText={(v) => setDescription(v)} error={errors.description} />
            <Input
              label="Ara toplam (KDV hariç)"
              required
              editable={!apiMode}
              keyboardType="decimal-pad"
              suffix="TL"
              value={subtotalOverride || formatAmountInput(String(autoSubtotal))}
              onChangeText={(v) => setSubtotalOverride(formatAmountInput(v))}
              error={errors.subtotal}
              hint={
                apiMode
                  ? 'Seçilen işlerin fiyatlarından sunucuda hesaplanır.'
                  : selectedJobs.length > 1
                    ? `Seçilen ${selectedJobs.length} işin toplam tutarı: ${formatCurrency(autoSubtotal)}`
                    : undefined
              }
            />
            <View style={{ gap: spacing.xs + 2 }}>
              <Text variant="label" tone="secondary">KDV oranı</Text>
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
              hint={apiMode ? 'Boş bırakılırsa firmanın kayıtlı IBAN\'ı faturaya yazılır.' : 'Faturanın açıklamasında yazılır.'}
            />
          </Card>
        </Section>

        {selectedJobs.length > 0 ? (
          <Section title="Önizleme">
            <InvoicePreview
              invoiceNo={apiMode ? 'TASLAK' : 'DEMO-…'}
              issueDate={issueDate}
              jobNo={selectedJobs.map(j => j.jobNo).join(', ')}
              customer={customer}
              description={displayDescription}
              vatRate={vatRate}
              {...totals}
              demo
              withholdingLabel={withholding && vatRate > 0 ? `KDV tevkifatı ${withholding.fraction} (${withholding.code})` : undefined}
              withholdingAmount={wh.withholdingAmount}
              payableAmount={wh.payableAmount}
              amountInWords={amountInWords(wh.payableAmount)}
              iban={iban.trim() ? formatIban(iban) : apiMode ? 'Firma IBAN\'ı (sunucu ayarı)' : undefined}
            />
            <Text variant="bodySmall" tone="secondary">
              {customer?.email ? `Entegrasyon sonrası fatura ${customer.email} adresine otomatik gönderilecek.` : 'Müşterinin kayıtlı e-posta adresi yok.'}
            </Text>
          </Section>
        ) : null}
      </ScrollContent>
      <BottomBar>
        <Button label="Vazgeç" variant="secondary" onPress={() => router.back()} style={{ flex: 1 }} />
        <Button label={apiMode ? 'Taslak fatura oluştur' : 'Demo fatura oluştur'} onPress={submit} loading={pending} style={{ flex: 2 }} />
      </BottomBar>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.lg },
  notice: { flexDirection: 'row', gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.ink, alignItems: 'flex-start' },
  jobChip: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, backgroundColor: colors.surfaceMuted, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
});
