import { router, useLocalSearchParams } from 'expo-router';
import { Ban, ChevronRight, FileSpreadsheet, Mail, MessageSquareLock, Printer, Send, Share2, ShieldCheck, Trash2, TriangleAlert } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { InvoicePreview } from '@/components/invoices/InvoicePreview';
import { InvoiceStatusBadge } from '@/components/invoices/InvoiceStatusBadge';
import { APP_CONFIG } from '@/constants/config';
import { Button, Card, EmptyState, InfoRow, Input, NavHeader, Screen, ScrollContent, Section, Sheet, Text } from '@/components/ui';
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
  const signing = useAsyncAction();
  /** GİB portalı imza SMS'i: kod istendiğinde dolar. */
  const [challenge, setChallenge] = useState<{ operationId: string; maskedPhone?: string } | null>(null);
  const [smsCode, setSmsCode] = useState('');

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
        : invoice.requiresSmsSignature
          ? 'GİB portalında taslak · SMS ile imza bekliyor'
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

  const issue = async () => {
    const inv = await action.run(() => invoiceActions.issue(invoice.id));
    if (!inv) return;
    if (inv.requiresSmsSignature) {
      // GİB portalı: taslak oluştu, kesmek için SMS ile imza gerekir.
      await requestSms();
    }
  };

  const requestSms = async () => {
    const c = await signing.run(() => invoiceActions.sendSignSms(invoice.id));
    if (c) {
      setSmsCode('');
      setChallenge(c);
    }
  };

  const sign = async () => {
    if (!challenge) return;
    const inv = await signing.run(() => invoiceActions.sign(invoice.id, challenge.operationId, smsCode.trim()), {
      error: 'Fatura imzalanamadı.',
    });
    if (inv?.status === 'earsiv_issued') setChallenge(null);
  };

  const discard = async () => {
    const ok = await confirm({
      title: 'Portal taslağını sil',
      message: 'GİB e-Arşiv portalındaki imzalanmamış taslak silinecek ve fatura yeniden düzenlenebilir taslak olacak.',
      confirmLabel: 'Taslağı sil',
      destructive: true,
    });
    if (ok) await action.run(() => invoiceActions.discardDraft(invoice.id), { success: 'Portal taslağı silindi.' });
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
          withholdingLabel={invoice.withholdingCode ? `KDV tevkifatı ${(invoice.withholdingRate ?? 0) / 10}/10 (${invoice.withholdingCode})` : undefined}
          withholdingAmount={invoice.withholdingAmount}
          payableAmount={invoice.payableAmount}
          amountInWords={invoice.amountInWords}
          iban={invoice.iban}
          bankName={invoice.bankName}
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
            {invoice.withholdingCode ? (
              <InfoRow label="Tevkifat" value={`${invoice.withholdingCode} · ${invoice.withholdingName ?? ''}`} />
            ) : null}
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

        {invoice.requiresSmsSignature ? (
          <View style={styles.notice}>
            <MessageSquareLock size={16} color={colors.text} />
            <Text variant="bodySmall" style={{ flex: 1 }}>
              Fatura GİB e-Arşiv portalında taslak olarak oluşturuldu ama henüz kesilmedi. Kesmek için portalda kayıtlı telefona gelen SMS koduyla imzalayın.
            </Text>
          </View>
        ) : null}

        {isDemo && !cancelled ? (
          <Button
            label="e-Arşiv'e gönder"
            icon={Send}
            variant="secondary"
            loading={action.pending}
            onPress={issue}
            accessibilityHint="Faturayı e-Arşiv sağlayıcısı üzerinden resmi faturaya dönüştürür"
          />
        ) : null}
        {invoice.requiresSmsSignature ? (
          <>
            <Button label="SMS ile imzala ve kes" icon={MessageSquareLock} loading={signing.pending} onPress={requestSms} />
            <Button label="Portal taslağını sil" icon={Trash2} variant="secondary" loading={action.pending} onPress={discard} />
          </>
        ) : !cancelled ? (
          <Button label="Faturayı iptal et" variant="danger" icon={Ban} onPress={cancel} />
        ) : null}
      </ScrollContent>

      <Sheet
        visible={challenge !== null}
        onClose={() => setChallenge(null)}
        title="SMS ile imzala"
        subtitle={challenge?.maskedPhone ? `Kod ${challenge.maskedPhone} numarasına gönderildi.` : 'Kod portalda kayıtlı telefona gönderildi.'}
        footer={
          <View style={styles.row}>
            <Button label="Yeni kod" variant="secondary" style={{ flex: 1 }} disabled={signing.pending} onPress={requestSms} />
            <Button label="İmzala" style={{ flex: 2 }} loading={signing.pending} disabled={smsCode.trim().length < 4} onPress={sign} />
          </View>
        }>
        <Input
          label="SMS kodu"
          value={smsCode}
          onChangeText={setSmsCode}
          keyboardType="number-pad"
          autoComplete="sms-otp"
          textContentType="oneTimeCode"
          maxLength={10}
          hint="İmza mali işlem oluşturur: fatura kesilir ve müşteriye e-postası gönderilir."
        />
      </Sheet>
    </Screen>
  );
}

const apiMode = APP_CONFIG.dataSource === 'api';

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm },
  item: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.lg },
  itemBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderStrong },
  error: { flexDirection: 'row', gap: spacing.sm, padding: spacing.md, borderRadius: 12, backgroundColor: colors.dangerSoft },
  notice: { flexDirection: 'row', gap: spacing.sm, padding: spacing.md, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.ink },
});
