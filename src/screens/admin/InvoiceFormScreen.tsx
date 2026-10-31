import { router, useLocalSearchParams } from 'expo-router';
import { Info, ReceiptText } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { InvoicePreview } from '@/components/invoices/InvoicePreview';
import { BottomBar, Button, Card, DateField, EmptyState, Input, NavHeader, Screen, ScrollContent, Section, SegmentedControl, SelectField, Text, type SelectOption } from '@/components/ui';
import { APP_CONFIG } from '@/constants/config';
import { useCurrentUser } from '@/contexts/AuthContext';
import { useAsyncAction } from '@/hooks/useAsyncAction';
import { useCustomers, useInvoices, useJobs } from '@/hooks/useData';
import { routes } from '@/navigation/routes';
import { calculateInvoiceTotals } from '@/services';
import { invoiceActions } from '@/store';
import { colors, radius, spacing } from '@/theme';
import { formatAmountInput, formatCurrency, formatDate, parseAmount, todayISO } from '@/utils/format';

const apiMode = APP_CONFIG.dataSource === 'api';

export default function InvoiceFormScreen() {
  const { jobId: presetJob } = useLocalSearchParams<{ jobId?: string }>();
  const user = useCurrentUser();
  const jobs = useJobs();
  const invoices = useInvoices();
  const customers = useCustomers();
  const { run, pending } = useAsyncAction();

  /** Faturası olmayan tamamlanmış işler. */
  const billable = useMemo(() => {
    const invoiced = new Set(invoices.filter((i) => i.status !== 'cancelled').map((i) => i.jobId));
    return jobs.filter((j) => j.status === 'completed' && !invoiced.has(j.id));
  }, [jobs, invoices]);

  const initialJob = billable.find((j) => j.id === presetJob);
  const [jobId, setJobId] = useState(initialJob?.id ?? '');
  const job = jobs.find((j) => j.id === jobId);
  const customer = customers.find((c) => c.id === job?.customerId) ?? null;

  const [issueDate, setIssueDate] = useState(todayISO());
  const [description, setDescription] = useState(initialJob ? `${initialJob.description} nakliye hizmeti` : '');
  const [subtotal, setSubtotal] = useState(initialJob ? formatAmountInput(String(initialJob.price)) : '');
  const [vatRate, setVatRate] = useState<number>(APP_CONFIG.defaultVatRate);
  const [errors, setErrors] = useState<{ job?: string; description?: string; subtotal?: string }>({});

  const jobOptions = useMemo<SelectOption[]>(
    () => billable.map((j) => ({ value: j.id, label: `${j.jobNo} · ${j.customerName}`, description: `${formatDate(j.date)} · ${formatCurrency(j.price)} · ${j.description}` })),
    [billable],
  );

  const amount = parseAmount(subtotal) ?? 0;
  const totals = calculateInvoiceTotals(amount, vatRate);

  const selectJob = (id: string) => {
    const j = jobs.find((x) => x.id === id);
    setJobId(id);
    if (j) {
      setDescription(`${j.description} nakliye hizmeti`);
      setSubtotal(formatAmountInput(String(j.price)));
    }
    setErrors({});
  };

  const submit = async () => {
    const e: typeof errors = {};
    if (!job) e.job = 'Faturalanacak işi seçin.';
    if (!description.trim()) e.description = 'Açıklama girin.';
    if (!(amount > 0)) e.subtotal = 'Ara toplam sıfırdan büyük olmalı.';
    setErrors(e);
    if (Object.keys(e).length) return;
    const inv = await run(() => invoiceActions.createDemo({ jobId, issueDate, description: description.trim(), subtotal: amount, vatRate }, user.id), {
      success: apiMode ? 'Taslak fatura oluşturuldu.' : 'Demo fatura oluşturuldu.',
    });
    if (inv) router.replace(routes.invoice(inv.id));
  };

  if (billable.length === 0 && !job) {
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
              ? 'Fatura taslak olarak oluşturulur ve resmi değildir. Tutar işin fiyatından hesaplanır. Resmi e-Arşiv faturası, sağlayıcı bağlandıktan sonra fatura detayındaki "e-Arşiv\'e gönder" ile kesilir ve müşteriye e-postayla gönderilir.'
              : 'Bu aşamada oluşturulan faturalar demo belgedir; resmi e-Arşiv faturası kesilmez ve müşteriye e-posta gönderilmez. Entegrasyon API aşamasında etkinleşecektir.'}
          </Text>
        </View>

        <Section title="Fatura bilgileri">
          <Card style={styles.card}>
            <SelectField label="İş" required searchable options={jobOptions} value={jobId || null} onChange={selectJob} error={errors.job} placeholder="Tamamlanan iş seçin" />
            <DateField label="Fatura tarihi" required value={issueDate} onChange={setIssueDate} />
            <Input label="Açıklama" required multiline value={description} onChangeText={setDescription} error={errors.description} />
            <Input
              label="Ara toplam (KDV hariç)"
              required
              keyboardType="decimal-pad"
              suffix="TL"
              value={subtotal}
              onChangeText={(v) => setSubtotal(formatAmountInput(v))}
              error={errors.subtotal}
              editable={!apiMode}
              hint={apiMode ? 'İşin fiyatından alınır. Değiştirmek için iş kaydını düzenleyin.' : undefined}
            />
            <View style={{ gap: spacing.xs + 2 }}>
              <Text variant="label" tone="secondary">KDV oranı</Text>
              <SegmentedControl value={String(vatRate)} onChange={(v) => setVatRate(Number(v))} options={APP_CONFIG.vatRates.map((r) => ({ value: String(r), label: `%${r}` }))} />
            </View>
          </Card>
        </Section>

        {job ? (
          <Section title="Önizleme">
            <InvoicePreview
              invoiceNo={apiMode ? 'TASLAK' : 'DEMO-…'}
              issueDate={issueDate}
              jobNo={job.jobNo}
              customer={customer}
              description={description}
              vatRate={vatRate}
              {...totals}
              demo
            />
            <Text variant="bodySmall" tone="secondary">
              {customer?.email ? `Entegrasyon sonrası fatura ${customer.email} adresine otomatik gönderilecek.` : 'Müşterinin kayıtlı e-posta adresi yok. Otomatik gönderim için müşteri kaydına e-posta ekleyin.'}
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
});
