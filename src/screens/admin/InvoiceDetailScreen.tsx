import { router, useLocalSearchParams } from 'expo-router';
import { Ban, ChevronRight, FileSpreadsheet, Mail, Printer, Send, Share2, ShieldCheck, TriangleAlert } from 'lucide-react-native';
import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { InvoicePreview } from '@/components/invoices/InvoicePreview';
import { InvoiceStatusBadge } from '@/components/invoices/InvoiceStatusBadge';
import { APP_CONFIG } from '@/constants/config';
import { Button, Card, EmptyState, InfoRow, NavHeader, Screen, ScrollContent, Section, Text } from '@/components/ui';
import { useAsyncAction } from '@/hooks/useAsyncAction';
import { useCustomer, useInvoice, useJobs } from '@/hooks/useData';
import { routes } from '@/navigation/routes';
import { invoiceService, reportService } from '@/services';
import { sharePdf } from '@/services/files';
import { invoiceActions } from '@/store';
import { colors, spacing } from '@/theme';
import type { InvoiceEmailStatus } from '@/types';
import { confirm } from '@/utils/confirm';
import { formatCurrency, formatDate, formatDateTime } from '@/utils/format';
import { composeJobText } from '@/utils/stops';

const EMAIL_LABEL: Record<InvoiceEmailStatus, string> = {
  not_sent: 'Gönderilmedi',
  queued: 'Gönderim sırasında',
  sent: 'Gönderildi',
  failed: 'Gönderilemedi',
};

export default function InvoiceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const invoice = useInvoice(id);
  const customer = useCustomer(invoice?.customerId);
  const jobs = useJobs();
  const share = useAsyncAction();
  const jobReport = useAsyncAction();
  const print = useAsyncAction();
  const action = useAsyncAction();

  // Liste yanıtında e-posta/e-Arşiv ayrıntıları yoktur; detay açılınca fatura tazelenir.
  useEffect(() => {
    if (id) invoiceActions.refresh(id).catch(() => {});
  }, [id]);

  if (!invoice) {
    return (
      <Screen>
        <NavHeader title="Fatura" />
        <View style={{ padding: spacing.lg }}>
          <EmptyState title="Fatura bulunamadı" />
        </View>
      </Screen>
    );
  }

  const isDemo = invoice.mode === 'demo';
  const cancelled = invoice.status === 'cancelled';
  const eArchiveLabel =
    invoice.status === 'earsiv_failed'
      ? 'Gönderim başarısız · tekrar deneyebilirsiniz'
      : isDemo
        ? APP_CONFIG.dataSource === 'api'
          ? 'Kesilmedi · taslak belge'
          : 'Bağlı değil · demo belge'
        : invoice.ettn
          ? `ETTN ${invoice.ettn}`
          : 'Gönderim bekleniyor';

  // Kalemler detayda gelir; demo kayıtlarda iş listesinden türetilir.
  const items =
    invoice.items ??
    jobs
      .filter((j) => (invoice.jobIds?.length ? invoice.jobIds : [invoice.jobId]).includes(j.id))
      .map((j) => ({ jobId: j.id, jobNo: j.jobNo, jobDate: j.date, storeName: j.storeName, description: composeJobText(j.routeDescription, j.description), amount: j.price }));

  /** API modunda sunucunun ürettiği PDF indirilir; demo modunda PDF cihazda üretilir. */
  const shareInvoicePdf = async () => {
    const uri = await invoiceService.downloadPdf(invoice.id, 'invoice');
    if (uri) await sharePdf(uri, invoice.invoiceNo);
    else await reportService.shareInvoice(invoice, customer ?? null);
  };
  const shareJobReportPdf = async () => {
    const uri = await invoiceService.downloadPdf(invoice.id, 'job-report');
    if (uri) await sharePdf(uri, `${invoice.invoiceNo} iş dökümü`);
    else await reportService.shareInvoiceJobReport(invoice, jobs.filter((j) => items.some((it) => it.jobId === j.id)));
  };

  const cancel = async () => {
    const ok = await confirm({ title: 'Faturayı iptal et', message: `${invoice.invoiceNo} iptal edilecek ve iş yeniden faturalanabilir hale gelecek.`, confirmLabel: 'İptal et', destructive: true });
    if (ok) await action.run(() => invoiceActions.cancel(invoice.id), { success: 'Fatura iptal edildi.' });
  };

  return (
    <Screen>
      <NavHeader title={invoice.invoiceNo} subtitle={invoice.customerName} />
      <ScrollContent>
        <InvoicePreview
          invoiceNo={invoice.invoiceNo}
          issueDate={invoice.issueDate}
          jobNo={items.length > 1 ? `${items.length} iş` : invoice.jobNo}
          customer={customer ?? { companyName: invoice.customerName, taxOffice: '', taxNumber: '', billingAddress: '' }}
          description={invoice.description}
          subtotal={invoice.subtotal}
          vatRate={invoice.vatRate}
          vatAmount={invoice.vatAmount}
          total={invoice.total}
          demo={isDemo}
          cancelled={cancelled}
        />

        <View style={styles.row}>
          <Button label="Fatura PDF" icon={Share2} variant="secondary" style={{ flex: 1 }} loading={share.pending} onPress={() => share.run(shareInvoicePdf, { error: 'Fatura PDF indirilemedi.' })} />
          <Button label="İş dökümü PDF" icon={FileSpreadsheet} variant="secondary" style={{ flex: 1 }} loading={jobReport.pending} onPress={() => jobReport.run(shareJobReportPdf, { error: 'İş dökümü PDF indirilemedi.' })} />
        </View>
        {!apiMode ? (
          <Button label="Yazdır" icon={Printer} variant="ghost" loading={print.pending} onPress={() => print.run(() => reportService.printInvoice(invoice, customer ?? null))} />
        ) : null}

        <Section title={`Faturadaki işler · ${items.length}`}>
          <Card padded={false}>
            {items.map((it, i) => (
              <Pressable
                key={it.jobId}
                onPress={() => router.push(routes.job(it.jobId))}
                style={({ pressed }) => [styles.item, i < items.length - 1 && styles.itemBorder, pressed && { opacity: 0.6 }]}
                accessibilityRole="button"
                accessibilityLabel={`${it.jobNo} iş detayı`}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="label">{it.jobNo} · {formatDate(it.jobDate)}</Text>
                  <Text variant="bodySmall" tone="secondary" numberOfLines={2}>{it.description}</Text>
                </View>
                <Text variant="label" style={{ fontVariant: ['tabular-nums'] }}>{formatCurrency(it.amount, { decimals: 2 })}</Text>
                <ChevronRight size={16} color={colors.textTertiary} />
              </Pressable>
            ))}
            {items.length === 0 ? <Text variant="bodySmall" tone="tertiary" style={{ padding: spacing.lg }}>Kalemler yükleniyor…</Text> : null}
          </Card>
        </Section>

        <Section title="Durum">
          <Card padded={false} style={{ paddingHorizontal: spacing.lg }}>
            <InfoRow icon={ShieldCheck} label="Fatura türü" value={<InvoiceStatusBadge invoice={invoice} />} />
            <InfoRow icon={ShieldCheck} label="e-Arşiv" value={eArchiveLabel} />
            <InfoRow icon={Mail} label="E-posta" value={`${EMAIL_LABEL[invoice.email.status]}${invoice.email.to ? ` · ${invoice.email.to}` : ''}`} />
            <InfoRow label="Oluşturulma" value={formatDateTime(invoice.createdAt)} last />
          </Card>
        </Section>

        {invoice.status === 'earsiv_failed' && invoice.lastError ? (
          <View style={styles.error} accessibilityRole="alert">
            <TriangleAlert size={16} color={colors.danger} />
            <Text variant="bodySmall" style={{ flex: 1 }}>{invoice.lastError}</Text>
          </View>
        ) : null}

        {isDemo && !cancelled ? (
          <Button
            label="e-Arşiv'e gönder"
            icon={Send}
            variant="secondary"
            loading={action.pending}
            onPress={() => action.run(() => invoiceActions.issue(invoice.id), { success: 'Fatura e-Arşiv sağlayıcısına gönderildi.' })}
            accessibilityHint="Faturayı e-Arşiv sağlayıcısı üzerinden resmi faturaya dönüştürür"
          />
        ) : null}
        {!cancelled ? <Button label="Faturayı iptal et" variant="danger" icon={Ban} onPress={cancel} /> : null}
      </ScrollContent>
    </Screen>
  );
}

const apiMode = APP_CONFIG.dataSource === 'api';

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm },
  item: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.lg },
  itemBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderStrong },
  error: { flexDirection: 'row', gap: spacing.sm, padding: spacing.md, borderRadius: 12, backgroundColor: colors.dangerSoft },
});
