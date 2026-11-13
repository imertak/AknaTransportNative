import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ban, CalendarClock, CircleCheck, CircleX, ClipboardCheck, Copy, Eye, MapPin, Pencil, Send, Share2, Trash2, Truck, UserRound } from 'lucide-react-native';
import { useCallback, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { OFFER_STATUS_LABEL, OfferStatusBadge, TRANSPORT_TYPE_LABEL } from '@/components/offers/OfferStatusBadge';
import { Button, Card, EmptyState, ErrorState, InfoRow, Input, LoadingState, NavHeader, Screen, ScrollContent, Section, Sheet, Text } from '@/components/ui';
import { useAsyncAction } from '@/hooks/useAsyncAction';
import { useRemote } from '@/hooks/useData';
import { routes } from '@/navigation/routes';
import { previewPdf, sharePdf } from '@/services/files';
import { offerService } from '@/services/offerService';
import { jobActions } from '@/store';
import { colors, radius, spacing } from '@/theme';
import type { OfferDetail } from '@/types/offers';
import { confirm } from '@/utils/confirm';
import { formatCurrency, formatDate, formatDateTime } from '@/utils/format';

type ReasonAction = 'reject' | 'cancel';

const quantityLabel = (q: number, unit: string | null) => `${String(q).replace('.', ',')}${unit ? ` ${unit}` : ''}`;

/** Teklif detayı: özet, PDF görüntüleme/paylaşma ve durum işlemleri. Hangi işlemin yapılabileceğini sunucu bildirir (can*). */
export default function OfferDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const remote = useRemote(id ? `offer-${id}` : null, () => offerService.get(id));
  // İşlem yanıtı (kabul, ret vb.) yeniden istek atmadan ekrana yansır; sunucudan yeni veri gelince o geçerli olur.
  const [local, setLocal] = useState<{ base: OfferDetail | undefined; value: OfferDetail } | null>(null);
  const offer = local && local.base === remote.data && local.value.id === id ? local.value : remote.data;
  const onChange = useCallback((value: OfferDetail) => setLocal({ base: remote.data, value }), [remote.data]);

  // Düzenleme ekranından dönünce teklif tazelenir.
  const focused = useRef(false);
  const { reload } = remote;
  useFocusEffect(
    useCallback(() => {
      if (focused.current) reload();
      focused.current = true;
    }, [reload]),
  );

  if (!offer) {
    return (
      <Screen>
        <NavHeader title="Teklif" />
        {remote.error ? <ErrorState message={remote.error} onRetry={reload} /> : <LoadingState label="Teklif yükleniyor" />}
      </Screen>
    );
  }
  return <OfferDetailView offer={offer} onChange={onChange} />;
}

function OfferDetailView({ offer, onChange }: { offer: OfferDetail; onChange: (o: OfferDetail) => void }) {
  const view = useAsyncAction();
  const share = useAsyncAction();
  const action = useAsyncAction();
  const [reasonFor, setReasonFor] = useState<ReasonAction | null>(null);
  const [reason, setReason] = useState('');

  const mutate = async (fn: () => Promise<OfferDetail>, success: string) => {
    const updated = await action.run(fn, { success });
    if (updated) onChange(updated);
    return updated;
  };

  /** PDF her seferinde sunucudan indirilir; böylece son düzenlemeler ve durum PDF'e yansır. */
  const viewPdf = () => view.run(async () => previewPdf(await offerService.downloadPdf(offer)), { error: 'Teklif PDF açılamadı.' });

  const sharePdfFile = async () => {
    const shared = await share.run(async () => {
      const uri = await offerService.downloadPdf(offer);
      await sharePdf(uri, offer.pdfFileName);
      return true;
    }, { error: 'Teklif PDF paylaşılamadı.' });
    // Paylaşımın gerçekten gönderilip gönderilmediği bilinemez; taslak teklif için kullanıcıya sorulur.
    if (shared && offer.canSend) {
      const ok = await confirm({
        title: 'Teklif gönderildi mi?',
        message: `${offer.offerNumber} müşteriye gönderildiyse "Beklemede" durumuna alınsın.`,
        confirmLabel: 'Gönderildi',
      });
      if (ok) await mutate(() => offerService.send(offer.id), 'Teklif beklemede olarak işaretlendi.');
    }
  };

  const markSent = () => mutate(() => offerService.send(offer.id), 'Teklif beklemede olarak işaretlendi.');

  const accept = async () => {
    const ok = await confirm({
      title: 'Teklifi kabul et',
      message: 'Müşteri teklifi onayladıysa kabul edin. Kabul edilen teklif kilitlenir ve değiştirilemez; sonrasında nakliye işine dönüştürebilirsiniz.',
      confirmLabel: 'Kabul et',
    });
    if (ok) await mutate(() => offerService.accept(offer.id), 'Teklif kabul edildi.');
  };

  const submitReason = async () => {
    if (!reasonFor) return;
    const updated = await mutate(
      () => (reasonFor === 'reject' ? offerService.reject(offer.id, reason) : offerService.cancel(offer.id, reason)),
      reasonFor === 'reject' ? 'Teklif reddedildi.' : 'Teklif iptal edildi.',
    );
    if (updated) setReasonFor(null);
  };

  const openReason = (kind: ReasonAction) => {
    setReason('');
    setReasonFor(kind);
  };

  const copy = async () => {
    const created = await action.run(() => offerService.copy(offer.id), { success: 'Teklif kopyalandı. Yeni taslağı düzenleyebilirsiniz.' });
    if (created) router.push(routes.offer(created.id));
  };

  const convert = async () => {
    const ok = await confirm({
      title: 'Nakliye işine dönüştür',
      message: `${offer.customerName} için ${offer.loadingPoint} → ${offer.unloadingPoint} nakliye işi oluşturulacak. İş fiyatı KDV hariç ${formatCurrency(offer.subTotal - offer.discountAmount, { decimals: 2 })} olur. Bir teklif yalnızca bir kez dönüştürülebilir.`,
      confirmLabel: 'İş oluştur',
    });
    if (!ok) return;
    const result = await action.run(() => offerService.convertToJob(offer.id), { error: 'Nakliye işi oluşturulamadı.' });
    if (!result) return;
    onChange(result.offer);
    // Yeni iş uygulama verisine eklenir ki iş detayı ve listeler hemen göstersin.
    await jobActions.refresh(result.jobId).catch(() => {});
    router.push(routes.job(result.jobId));
  };

  const remove = async () => {
    const ok = await confirm({
      title: 'Teklifi sil',
      message: `${offer.offerNumber} teklif listesinden kaldırılacak.`,
      confirmLabel: 'Sil',
      destructive: true,
    });
    if (!ok) return;
    const done = await action.run(async () => {
      await offerService.remove(offer.id);
      return true;
    }, { success: 'Teklif silindi.' });
    if (done) router.back();
  };

  const net = offer.subTotal - offer.discountAmount;
  const closedNote =
    offer.status === 'Rejected'
      ? `Reddedildi${offer.rejectedAt ? ` · ${formatDateTime(offer.rejectedAt)}` : ''}${offer.rejectionReason ? `\n${offer.rejectionReason}` : ''}`
      : offer.status === 'Cancelled'
        ? `İptal edildi${offer.cancelledAt ? ` · ${formatDateTime(offer.cancelledAt)}` : ''}${offer.cancellationReason ? `\n${offer.cancellationReason}` : ''}`
        : offer.status === 'Expired'
          ? `Geçerlilik süresi ${formatDate(offer.validUntil)} tarihinde doldu. Düzenleyip geçerlilik tarihini uzatabilir veya kopyalayabilirsiniz.`
          : null;

  return (
    <Screen>
      <NavHeader title={offer.offerNumber} subtitle={offer.customerName} />
      <ScrollContent>
        <Card style={{ gap: spacing.md }}>
          <View style={styles.headRow}>
            <OfferStatusBadge status={offer.status} />
            <Text variant="bodySmall" tone="secondary">
              {formatDate(offer.offerDate)} · {formatDate(offer.validUntil)} tarihine kadar geçerli
            </Text>
          </View>
          <View>
            <Text variant="bodySmall" tone="secondary">Genel toplam (KDV dahil)</Text>
            <Text variant="title" style={{ fontVariant: ['tabular-nums'] }}>{formatCurrency(offer.totalAmount, { decimals: 2 })}</Text>
          </View>
          <View style={styles.route}>
            <MapPin size={16} color={colors.textSecondary} />
            <Text variant="subheading" style={{ flex: 1 }}>
              {offer.loadingPoint} → {offer.unloadingPoint}
            </Text>
          </View>
        </Card>

        {closedNote ? (
          <View style={offer.status === 'Expired' ? styles.notice : styles.error} accessibilityRole="alert">
            <Text variant="bodySmall">{closedNote}</Text>
          </View>
        ) : null}

        <Button
          label="WhatsApp ile paylaş"
          icon={Share2}
          loading={share.pending}
          onPress={sharePdfFile}
          accessibilityHint="Teklif PDF'ini paylaşım menüsüyle açar; WhatsApp'ı seçip müşteriye gönderebilirsiniz"
        />
        <Button label="PDF görüntüle" icon={Eye} variant="secondary" loading={view.pending} onPress={viewPdf} />

        {offer.convertedJobId ? (
          <Button
            label={`Nakliye işini aç${offer.convertedJobNumber ? ` · ${offer.convertedJobNumber}` : ''}`}
            icon={Truck}
            variant="secondary"
            onPress={() => router.push(routes.job(offer.convertedJobId!))}
          />
        ) : null}
        {offer.canConvert ? <Button label="Nakliye işine dönüştür" icon={Truck} loading={action.pending} onPress={convert} /> : null}
        {offer.canAccept || offer.canReject ? (
          <View style={styles.row}>
            {offer.canAccept ? <Button label="Kabul et" icon={CircleCheck} style={{ flex: 1 }} disabled={action.pending} onPress={accept} /> : null}
            {offer.canReject ? <Button label="Reddet" icon={CircleX} variant="secondary" style={{ flex: 1 }} disabled={action.pending} onPress={() => openReason('reject')} /> : null}
          </View>
        ) : null}
        {offer.canSend ? (
          <Button label="Gönderildi olarak işaretle" icon={Send} variant="secondary" disabled={action.pending} onPress={markSent} accessibilityHint="Teklifi beklemede durumuna alır" />
        ) : null}
        <View style={styles.row}>
          {offer.canEdit ? <Button label="Düzenle" icon={Pencil} variant="secondary" style={{ flex: 1 }} onPress={() => router.push(routes.editOffer(offer.id))} /> : null}
          <Button label="Kopyala" icon={Copy} variant="secondary" style={{ flex: 1 }} disabled={action.pending} onPress={copy} accessibilityHint="Aynı bilgilerle yeni taslak teklif oluşturur" />
        </View>

        <Section title="Müşteri">
          <Card padded={false} style={styles.infoCard}>
            <InfoRow icon={UserRound} label="Firma" value={offer.customerName} onPress={() => router.push(routes.customer(offer.customerId))} last={!offer.contactPerson && !offer.customerPhone && !offer.customerEmail && !offer.customerAddress} />
            {offer.contactPerson ? <InfoRow label="Yetkili" value={offer.contactPerson} /> : null}
            {offer.customerPhone ? <InfoRow label="Telefon" value={offer.customerPhone} /> : null}
            {offer.customerEmail ? <InfoRow label="E-posta" value={offer.customerEmail} /> : null}
            {offer.customerAddress ? <InfoRow label="Adres" value={offer.customerAddress} last /> : null}
          </Card>
        </Section>

        <Section title="Taşıma">
          <Card padded={false} style={styles.infoCard}>
            <InfoRow icon={MapPin} label="Yükleme" value={[offer.loadingPoint, offer.loadingAddress].filter(Boolean).join('\n')} />
            <InfoRow icon={MapPin} label="Boşaltma" value={[offer.unloadingPoint, offer.unloadingAddress].filter(Boolean).join('\n')} />
            <InfoRow icon={Truck} label="Araç / tür" value={`${offer.vehicleTypeName} · ${TRANSPORT_TYPE_LABEL[offer.transportType]}`} />
            {offer.cargoDescription ? <InfoRow label="Yük" value={offer.cargoDescription} /> : null}
            {offer.loadingDate || offer.deliveryDate ? (
              <InfoRow
                icon={CalendarClock}
                label="Tarihler"
                value={[offer.loadingDate ? `Yükleme ${formatDate(offer.loadingDate)}` : null, offer.deliveryDate ? `Teslimat ${formatDate(offer.deliveryDate)}` : null].filter(Boolean).join(' · ')}
              />
            ) : null}
            <InfoRow label="Mesafe" value={offer.distanceKm != null ? `${String(offer.distanceKm).replace('.', ',')} km` : '—'} last />
          </Card>
        </Section>

        <Section title={`Fiyat kalemleri · ${offer.items.length}`}>
          <Card padded={false}>
            {offer.items.map((it, i) => (
              <View key={it.id} style={[styles.item, i < offer.items.length - 1 && styles.itemBorder]}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="label">{it.description}</Text>
                  <Text variant="bodySmall" tone="secondary">
                    {quantityLabel(it.quantity, it.unit)} × {formatCurrency(it.unitPrice, { decimals: 2 })}
                  </Text>
                </View>
                <Text variant="label" style={{ fontVariant: ['tabular-nums'] }}>{formatCurrency(it.totalPrice, { decimals: 2 })}</Text>
              </View>
            ))}
            <View style={styles.totals}>
              <TotalRow label="Ara toplam" value={offer.subTotal} />
              {offer.discountAmount > 0 ? <TotalRow label="İndirim" value={-offer.discountAmount} /> : null}
              {offer.discountAmount > 0 ? <TotalRow label="İndirimli tutar" value={net} /> : null}
              <TotalRow label={`KDV (%${offer.vatRate})`} value={offer.vatAmount} />
              <View style={styles.grand}>
                <Text variant="subheading" style={{ color: colors.textInverse }}>Genel toplam</Text>
                <Text variant="heading" style={{ color: colors.textInverse, fontVariant: ['tabular-nums'] }}>{formatCurrency(offer.totalAmount, { decimals: 2 })}</Text>
              </View>
            </View>
          </Card>
        </Section>

        {offer.paymentTerms || offer.deliveryTerms || offer.customerNotes || offer.internalNotes ? (
          <Section title="Koşullar ve notlar">
            <Card padded={false} style={styles.infoCard}>
              {offer.paymentTerms ? <InfoRow label="Ödeme" value={offer.paymentTerms} /> : null}
              {offer.deliveryTerms ? <InfoRow label="Teslimat" value={offer.deliveryTerms} /> : null}
              {offer.customerNotes ? <InfoRow label="Müşteriye not" value={offer.customerNotes} /> : null}
              {offer.internalNotes ? <InfoRow label="Özel not (PDF'te yok)" value={offer.internalNotes} last /> : null}
            </Card>
          </Section>
        ) : null}

        <Section title="Durum geçmişi">
          <Card padded={false} style={styles.infoCard}>
            {offer.history.length === 0 ? (
              <View style={{ paddingVertical: spacing.md }}>
                <EmptyState icon={ClipboardCheck} title="Kayıt yok" compact />
              </View>
            ) : (
              offer.history.map((h, i) => (
                <View key={h.id} style={[styles.history, i < offer.history.length - 1 && styles.itemBorder]}>
                  <Text variant="label">
                    {h.oldStatus && h.oldStatus !== h.newStatus ? `${OFFER_STATUS_LABEL[h.oldStatus]} → ${OFFER_STATUS_LABEL[h.newStatus]}` : OFFER_STATUS_LABEL[h.newStatus]}
                  </Text>
                  {h.description ? <Text variant="bodySmall" tone="secondary">{h.description}</Text> : null}
                  <Text variant="caption" tone="tertiary">
                    {formatDateTime(h.createdAt)}
                    {h.changedByUserName ? ` · ${h.changedByUserName}` : ''}
                  </Text>
                </View>
              ))
            )}
          </Card>
        </Section>

        {offer.canCancel ? <Button label="Teklifi iptal et" icon={Ban} variant="secondary" disabled={action.pending} onPress={() => openReason('cancel')} /> : null}
        {offer.canDelete ? <Button label="Teklifi sil" icon={Trash2} variant="danger" disabled={action.pending} onPress={remove} /> : null}
        <Text variant="caption" tone="tertiary" align="center">
          {offer.pdfFileName}
          {offer.createdByUserName ? ` · Hazırlayan ${offer.createdByUserName}` : ''}
        </Text>
      </ScrollContent>

      <Sheet
        visible={reasonFor !== null}
        onClose={() => setReasonFor(null)}
        title={reasonFor === 'reject' ? 'Teklifi reddet' : 'Teklifi iptal et'}
        subtitle={reasonFor === 'reject' ? 'Müşteri teklifi kabul etmediyse kaydedin. Reddedilen teklif yeniden açılamaz; gerekirse kopyalayın.' : 'İptal edilen teklif yeniden açılamaz; gerekirse kopyalayın.'}
        footer={
          <Button
            label={reasonFor === 'reject' ? 'Reddet' : 'İptal et'}
            variant={reasonFor === 'cancel' ? 'danger' : 'primary'}
            loading={action.pending}
            onPress={submitReason}
          />
        }>
        <View style={{ paddingHorizontal: spacing.xl }}>
          <Input
            label="Neden (isteğe bağlı)"
            multiline
            value={reason}
            onChangeText={setReason}
            maxLength={500}
            placeholder={reasonFor === 'reject' ? 'Örn. Fiyat yüksek bulundu' : 'Örn. Müşteri talebi geri çekti'}
          />
        </View>
      </Sheet>
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
  row: { flexDirection: 'row', gap: spacing.sm },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  route: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  infoCard: { paddingHorizontal: spacing.lg },
  item: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.lg },
  itemBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderStrong },
  history: { paddingVertical: spacing.md, gap: 2 },
  totals: { gap: spacing.sm, padding: spacing.lg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderStrong },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  grand: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.ink, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.md, marginTop: spacing.xs },
  error: { padding: spacing.md, borderRadius: 12, backgroundColor: colors.dangerSoft },
  notice: { padding: spacing.md, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.ink },
});
