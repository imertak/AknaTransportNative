import { router, useLocalSearchParams } from 'expo-router';
import { Ban, ChevronRight, FileSpreadsheet, FileText, FileUp, Mail, MessageSquareLock, Send, ShieldCheck, Trash2, TriangleAlert } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { InvoicePreview } from '@/components/invoices/InvoicePreview';
import { InvoiceStatusBadge } from '@/components/invoices/InvoiceStatusBadge';
import { Button, Card, EmptyState, InfoRow, Input, NavHeader, Screen, ScrollContent, Section, Sheet, Text } from '@/components/ui';
import { useAsyncAction } from '@/hooks/useAsyncAction';
import { useCustomer, useInvoice, useJobs } from '@/hooks/useData';
import { routes } from '@/navigation/routes';
import { invoiceService, reportService } from '@/services';
import { pickPdf, type PdfFile, type PickedFile } from '@/services/files';
import { PdfReadySheet } from '@/components/PdfReadySheet';
import { invoiceActions } from '@/store';
import { colors, spacing } from '@/theme';
import type { InvoiceEmailStatus, InvoiceItem } from '@/types';
import { confirm } from '@/utils/confirm';
import { formatCurrency, formatDate, formatDateTime } from '@/utils/format';
import { lineQuantityLabel, SINGLE_LINE_TITLE } from '@/utils/invoiceText';
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
  const action = useAsyncAction();
  const signing = useAsyncAction();
  const mail = useAsyncAction();
  /** GİB portalı imza SMS'i: kod istendiğinde dolar. */
  const [challenge, setChallenge] = useState<{ operationId: string; maskedPhone?: string } | null>(null);
  const [smsCode, setSmsCode] = useState('');
  /** Hazırlanan PDF: önce önizlenir, sonra paylaşılır. */
  const [pdf, setPdf] = useState<PdfFile | null>(null);
  /** Elle fatura yükleme: başka yerde kesilen faturanın PDF'i. */
  const upload = useAsyncAction();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<PickedFile | null>(null);
  const [uploadNo, setUploadNo] = useState('');

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
  const manual = invoice.manual === true;
  /** Taslak veya başarısız faturaya ya da elle yüklenmiş faturaya dosya yüklenebilir. */
  const canUpload = !cancelled && (isDemo || (manual && invoice.status === 'earsiv_issued'));
  const eArchiveLabel = manual && invoice.status === 'earsiv_issued'
    ? `Elle yüklendi${invoice.externalId ? ` · No ${invoice.externalId}` : ''}`
    : invoice.status === 'earsiv_failed'
      ? 'Gönderim başarısız · tekrar deneyebilirsiniz'
      : isDemo
        ? 'Kesilmedi · taslak belge'
        : invoice.requiresSmsSignature
          ? 'GİB portalında taslak · SMS ile imza bekliyor'
          : invoice.ettn
          ? `ETTN ${invoice.ettn}`
          : 'Gönderim bekleniyor';

  // Serbest fatura: işe bağlı olmayan, elle girilen kalemler (iş dökümü yok).
  const freeForm = !!invoice.freeForm;
  // Kalemler detayda gelir; demo kayıtlarda iş listesinden türetilir.
  const items: InvoiceItem[] =
    invoice.items ??
    jobs
      .filter((j) => (invoice.jobIds?.length ? invoice.jobIds : [invoice.jobId]).includes(j.id))
      .map((j) => ({ jobId: j.id, jobNo: j.jobNo, jobDate: j.date, storeName: j.storeName, description: composeJobText(j.routeDescription, j.description), amount: j.price }));

  /** Sunucunun ürettiği PDF indirilir; web gibi dosya kaydedilemeyen ortamlarda cihazda üretilir. */
  const shareInvoicePdf = async () => {
    const uri = await invoiceService.downloadPdf(invoice.id, 'invoice', invoice.invoiceNo);
    setPdf(uri ? { uri, title: invoice.invoiceNo } : await reportService.invoicePdf(invoice, customer ?? null));
  };
  const shareJobReportPdf = async () => {
    const uri = await invoiceService.downloadPdf(invoice.id, 'job-report', invoice.invoiceNo);
    setPdf(
      uri
        ? { uri, title: `${invoice.invoiceNo} iş dökümü` }
        : await reportService.invoiceJobReportPdf(invoice, jobs.filter((j) => items.some((it) => it.jobId === j.id))),
    );
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

  const sendEmail = async () => {
    const to = customer?.email || invoice.email.to;
    const cc = customer?.extraEmails ?? [];
    // Adres yoksa sunucu açıklayıcı hata döner (müşteri kaydına e-posta eklenmeli).
    const ok = await confirm({
      title: isDemo ? 'Taslağı e-postayla gönder' : 'Faturayı e-postayla gönder',
      message: [
        to ? `Alıcı: ${to}` : null,
        cc.length ? `Bilgi (CC): ${cc.join(', ')}` : null,
        isDemo
          ? 'Taslak fatura PDF\'i ve iş dökümü gönderilecek. E-postada resmi fatura olmadığı belirtilir; fatura taslak olarak kalır.'
          : 'Fatura PDF\'i ve iş dökümü gönderilecek.',
      ]
        .filter(Boolean)
        .join('\n\n'),
      confirmLabel: 'Gönder',
    });
    if (!ok) return;
    const inv = await mail.run(() => invoiceActions.sendEmail(invoice.id), { success: 'E-posta gönderim kuyruğuna alındı.' });
    // Gönderim arka planda yapılır; birkaç saniye sonra durum tazelenir.
    if (inv) setTimeout(() => invoiceActions.refresh(invoice.id).catch(() => {}), 6000);
  };

  const openUpload = () => {
    setUploadFile(null);
    setUploadNo(manual ? (invoice.externalId ?? '') : '');
    setUploadOpen(true);
  };

  const choosePdf = async () => {
    const f = await upload.run(pickPdf, { error: 'Dosya seçilemedi.' });
    if (f) setUploadFile(f);
  };

  const submitUpload = async () => {
    if (!uploadFile) return;
    const inv = await upload.run(() => invoiceActions.uploadManualPdf(invoice.id, uploadFile, uploadNo), {
      success: manual ? 'Fatura dosyası değiştirildi.' : 'Fatura yüklendi. İş dökümüyle birlikte kullanabilirsiniz.',
      error: 'Fatura yüklenemedi.',
    });
    if (inv) setUploadOpen(false);
  };

  const cancel = async () => {
    const ok = await confirm({
      title: 'Faturayı iptal et',
      message: manual
        ? `${invoice.invoiceNo} uygulamada iptal edilecek ve iş yeniden faturalanabilir hale gelecek. Fatura başka yerde kesildiği için asıl iptali orada yapın.`
        : `${invoice.invoiceNo} iptal edilecek ve iş yeniden faturalanabilir hale gelecek.`,
      confirmLabel: 'İptal et',
      destructive: true,
    });
    if (ok) await action.run(() => invoiceActions.cancel(invoice.id), { success: 'Fatura iptal edildi.' });
  };

  const remove = async () => {
    const ok = await confirm({
      title: 'Faturayı sil',
      message: `${invoice.invoiceNo} kalıcı olarak silinecek ve faturalar listesinden kalkacak. Bu işlem geri alınamaz.`,
      confirmLabel: 'Sil',
      destructive: true,
    });
    if (!ok) return;
    const done = await action.run(() => invoiceActions.remove(invoice.id), { success: 'Fatura silindi.' });
    if (done) router.back();
  };

  return (
    <Screen>
      <NavHeader title={invoice.invoiceNo} subtitle={invoice.customerName} />
      <ScrollContent>
        <InvoicePreview
          invoiceNo={invoice.invoiceNo}
          issueDate={invoice.issueDate}
          jobNo={freeForm ? '—' : items.length > 1 ? `${items.length} iş` : invoice.jobNo}
          customer={customer ?? { companyName: invoice.customerName, taxOffice: '', taxNumber: '', billingAddress: '' }}
          description={invoice.description}
          lines={
            invoice.singleLine
              ? [{ key: 'single', title: SINGLE_LINE_TITLE, detail: '', amount: invoice.subtotal }]
              : items.map((it, i) =>
                  it.jobId
                    ? { key: it.id ?? it.jobId, title: `${it.jobNo} · ${formatDate(it.jobDate)}`, detail: it.description, amount: it.amount }
                    : { key: it.id ?? String(i), title: it.description, detail: '', amount: it.amount, quantityLabel: lineQuantityLabel(it.quantity, it.unitPrice) },
                )
          }
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
          <Button label="Fatura PDF" icon={FileText} variant="secondary" style={{ flex: 1 }} loading={share.pending} onPress={() => share.run(shareInvoicePdf, { error: 'Fatura PDF indirilemedi.' })} />
          {freeForm ? null : (
            <Button label="İş dökümü PDF" icon={FileSpreadsheet} variant="secondary" style={{ flex: 1 }} loading={jobReport.pending} onPress={() => jobReport.run(shareJobReportPdf, { error: 'İş dökümü PDF indirilemedi.' })} />
          )}
        </View>

        {!cancelled ? (
          <Button
            label={isDemo ? 'Taslağı e-postayla gönder' : 'E-postayla gönder'}
            icon={Mail}
            loading={mail.pending}
            disabled={invoice.manualEmail?.status === 'queued'}
            onPress={sendEmail}
            accessibilityHint={freeForm ? "Fatura PDF'ini müşterinin e-posta adreslerine gönderir" : "Fatura PDF'i ve iş dökümünü müşterinin e-posta adreslerine gönderir"}
          />
        ) : null}

        <Section title={`${freeForm ? 'Fatura kalemleri' : 'Faturadaki işler'} · ${items.length}`}>
          <Card padded={false}>
            {items.map((it, i) => !it.jobId ? (
              <View key={it.id ?? String(i)} style={[styles.item, i < items.length - 1 && styles.itemBorder]}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="label">{it.description}</Text>
                  <Text variant="bodySmall" tone="secondary">{lineQuantityLabel(it.quantity, it.unitPrice)}</Text>
                </View>
                <Text variant="label" style={{ fontVariant: ['tabular-nums'] }}>{formatCurrency(it.amount, { decimals: 2 })}</Text>
              </View>
            ) : (
              <Pressable
                key={it.jobId}
                onPress={() => router.push(routes.job(it.jobId))}
                style={({ pressed }) => [styles.item, i < items.length - 1 && styles.itemBorder, pressed && { opacity: 0.6 }]}
                accessibilityRole="button"
                accessibilityLabel={`${it.jobNo} iş detayı`}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="label">{it.jobNo} · {formatDate(it.jobDate)} · 1 adet</Text>
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
            <InfoRow icon={Mail} label={isDemo ? 'E-posta (kesilince)' : 'E-posta'} value={`${EMAIL_LABEL[invoice.email.status]}${invoice.email.to ? ` · ${invoice.email.to}` : ''}`} />
            {invoice.manualEmail ? (
              <InfoRow
                icon={Send}
                label="Son gönderim"
                value={`${EMAIL_LABEL[invoice.manualEmail.status]} · ${formatDateTime(invoice.manualEmail.sentAt ?? invoice.manualEmail.requestedAt)}${
                  invoice.manualEmail.status === 'failed' && invoice.manualEmail.error ? ` · ${invoice.manualEmail.error}` : ''
                }`}
              />
            ) : null}
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

        {canUpload ? (
          <Button
            label={manual ? 'Fatura dosyasını değiştir' : 'Faturayı elle yükle'}
            icon={FileUp}
            variant="secondary"
            onPress={openUpload}
            accessibilityHint="Başka yerde kesilen faturanın PDF'ini yükler; iş dökümü aynen kullanılır"
          />
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
        ) : (
          <Button label="Faturayı sil" variant="danger" icon={Trash2} loading={action.pending} onPress={remove} />
        )}
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
        <View style={{ paddingHorizontal: spacing.xl }}>
          <Input
            label="SMS kodu"
            value={smsCode}
            onChangeText={setSmsCode}
            keyboardType="default"
            autoCapitalize="characters"
            autoCorrect={false}
            autoComplete="sms-otp"
            textContentType="oneTimeCode"
            maxLength={10}
            hint="İmza mali işlem oluşturur: fatura kesilir ve müşteriye e-postası gönderilir."
          />
        </View>
      </Sheet>
      <Sheet
        visible={uploadOpen}
        onClose={() => setUploadOpen(false)}
        title={manual ? 'Fatura dosyasını değiştir' : 'Faturayı elle yükle'}
        subtitle="Faturayı başka yerde kestirdiyseniz PDF'ini yükleyin. Fatura kesilmiş sayılır, cari bakiyeye yazılır ve iş dökümü aynen kullanılır. Müşteriye otomatik e-posta gitmez."
        footer={
          <Button
            label={manual ? 'Dosyayı değiştir' : 'Yükle'}
            icon={FileUp}
            loading={upload.pending}
            disabled={!uploadFile}
            onPress={submitUpload}
          />
        }>
        <View style={{ paddingHorizontal: spacing.xl, gap: spacing.md }}>
          <Button
            label={uploadFile ? uploadFile.name : 'PDF seç'}
            icon={FileText}
            variant="secondary"
            disabled={upload.pending}
            onPress={choosePdf}
            accessibilityHint="Cihazdan fatura PDF'ini seçer"
          />
          <Input
            label="Fatura numarası (isteğe bağlı)"
            value={uploadNo}
            onChangeText={setUploadNo}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={50}
            hint="Kesilen faturanın üzerindeki numara. Dökümde ve e-postada bu numara görünür."
          />
        </View>
      </Sheet>
      <PdfReadySheet pdf={pdf} onClose={() => setPdf(null)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm },
  item: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.lg },
  itemBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderStrong },
  error: { flexDirection: 'row', gap: spacing.sm, padding: spacing.md, borderRadius: 12, backgroundColor: colors.dangerSoft },
  notice: { flexDirection: 'row', gap: spacing.sm, padding: spacing.md, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.ink },
});
