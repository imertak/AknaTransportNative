import { router, useLocalSearchParams } from 'expo-router';
import { Ban, ClipboardList, Mail, Printer, Send, Share2, ShieldCheck } from 'lucide-react-native';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import { InvoicePreview } from '@/components/invoices/InvoicePreview';
import { InvoiceStatusBadge } from '@/components/invoices/InvoiceStatusBadge';
import { APP_CONFIG } from '@/constants/config';
import { Button, Card, EmptyState, InfoRow, NavHeader, Screen, ScrollContent, Section } from '@/components/ui';
import { useAsyncAction } from '@/hooks/useAsyncAction';
import { useCustomer, useInvoice } from '@/hooks/useData';
import { routes } from '@/navigation/routes';
import { reportService } from '@/services';
import { invoiceActions } from '@/store';
import { spacing } from '@/theme';
import type { InvoiceEmailStatus } from '@/types';
import { confirm } from '@/utils/confirm';
import { formatDateTime } from '@/utils/format';

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
  const share = useAsyncAction();
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
          jobNo={invoice.jobNo}
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
          <Button label="PDF paylaş" icon={Share2} variant="secondary" style={{ flex: 1 }} loading={share.pending} onPress={() => share.run(() => reportService.shareInvoice(invoice, customer ?? null))} />
          <Button label="Yazdır" icon={Printer} variant="secondary" style={{ flex: 1 }} loading={print.pending} onPress={() => print.run(() => reportService.printInvoice(invoice, customer ?? null))} />
        </View>

        <Section title="Durum">
          <Card padded={false} style={{ paddingHorizontal: spacing.lg }}>
            <InfoRow icon={ShieldCheck} label="Fatura türü" value={<InvoiceStatusBadge invoice={invoice} />} />
            <InfoRow icon={ShieldCheck} label="e-Arşiv" value={eArchiveLabel} />
            <InfoRow icon={Mail} label="E-posta" value={`${EMAIL_LABEL[invoice.email.status]}${invoice.email.to ? ` · ${invoice.email.to}` : ''}`} />
            <InfoRow icon={ClipboardList} label="İş" value={invoice.jobNo} onPress={() => router.push(routes.job(invoice.jobId))} />
            <InfoRow label="Oluşturulma" value={formatDateTime(invoice.createdAt)} last />
          </Card>
        </Section>

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

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm },
});
