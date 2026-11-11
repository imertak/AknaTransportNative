import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';
import type { Customer } from '@/types';
import { formatCurrency, formatDate } from '@/utils/format';

/** Resmi olmayan (henüz kesilmemiş) faturalar "taslak" olarak etiketlenir. */
const DRAFT = { word: 'Taslak', stamp: 'TASLAK' };

/** Faturadaki her iş ayrı bir satırdır (1 adet). Serbest faturada satırlar elle girilir. */
export interface InvoicePreviewLine {
  key: string;
  title: string;
  detail: string;
  amount: number;
  /** Ör. "3 adet × 1.500 ₺". Boşsa "1 adet". */
  quantityLabel?: string;
}

interface Props {
  invoiceNo: string;
  issueDate: string;
  jobNo: string;
  customer: Pick<Customer, 'companyName' | 'taxOffice' | 'taxNumber' | 'billingAddress'> | null;
  description: string;
  /** Verilirse her iş ayrı satır olarak gösterilir; iş numaraları satırlarda yer aldığından üstteki "İş no" sütunu gizlenir. */
  lines?: InvoicePreviewLine[];
  subtotal: number;
  vatRate: number;
  vatAmount: number;
  total: number;
  demo: boolean;
  cancelled?: boolean;
  /** Ör. "KDV tevkifatı 2/10 (624)". Boşsa tevkifat yok. */
  withholdingLabel?: string;
  withholdingAmount?: number;
  payableAmount?: number;
  /** İsteğe bağlı fatura notu; açıklama bölümünde gösterilir. */
  note?: string;
  /** "YALNIZ: ... TÜRK LİRASI" */
  amountInWords?: string;
  iban?: string;
  bankName?: string;
}

/** Fatura belge önizlemesi. Taslak faturalar açıkça işaretlenir. */
export const InvoicePreview = memo(function InvoicePreview(p: Props) {
  return (
    <View style={styles.doc}>
      {p.demo ? (
        <View style={styles.demoBar}>
          <Text variant="caption" tone="inverse">{DRAFT.word} belge · resmi fatura değildir</Text>
        </View>
      ) : null}
      <View style={styles.inner}>
        <View style={styles.head}>
          <View>
            <Text variant="subheading" style={{ letterSpacing: 2.5 }}>AKNA TRANSPORT</Text>
            <Text variant="bodySmall" tone="tertiary">Nakliye ve lojistik hizmetleri</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text variant="caption" tone="secondary">{p.demo ? `${DRAFT.word} fatura` : 'e-Arşiv fatura'}</Text>
            <Text variant="label">{p.invoiceNo}</Text>
            <Text variant="bodySmall" tone="secondary">{formatDate(p.issueDate)}</Text>
          </View>
        </View>

        <View style={styles.parties}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="caption" tone="tertiary">Sayın</Text>
            <Text variant="subheading">{p.customer?.companyName ?? '—'}</Text>
            {p.customer?.billingAddress ? <Text variant="bodySmall" tone="secondary">{p.customer.billingAddress}</Text> : null}
            {p.customer?.taxNumber ? (
              <Text variant="bodySmall" tone="secondary">
                {p.customer.taxOffice} · VKN {p.customer.taxNumber}
              </Text>
            ) : null}
          </View>
          {p.lines?.length ? null : (
            <View style={styles.jobNo}>
              <Text variant="caption" tone="tertiary">İş no</Text>
              <Text variant="label" numberOfLines={2} style={{ textAlign: 'right' }}>{p.jobNo}</Text>
            </View>
          )}
        </View>

        {p.lines?.length ? (
          <View style={styles.lines}>
            {p.lines.map((l, i) => (
              <View key={l.key} style={[styles.lineItem, i > 0 && styles.lineBorder]}>
                <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                  <Text variant="label" numberOfLines={1}>{l.title}</Text>
                  {l.detail ? <Text variant="bodySmall" tone="secondary" numberOfLines={2}>{l.detail}</Text> : null}
                </View>
                <View style={{ alignItems: 'flex-end', gap: 2 }}>
                  <Text variant="label" style={styles.num}>{formatCurrency(l.amount, { decimals: 2 })}</Text>
                  <Text variant="caption" tone="tertiary">{l.quantityLabel ?? '1 adet'}</Text>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.line}>
            <Text variant="bodySmall" style={{ flex: 1 }}>{p.description || '—'}</Text>
            <Text variant="label" style={styles.num}>{formatCurrency(p.subtotal, { decimals: 2 })}</Text>
          </View>
        )}

        <View style={styles.totals}>
          <Row label="Ara toplam" value={formatCurrency(p.subtotal, { decimals: 2 })} />
          <Row label={`KDV (%${p.vatRate})`} value={formatCurrency(p.vatAmount, { decimals: 2 })} />
          {p.withholdingLabel ? (
            <>
              <Row label="Vergiler dahil toplam" value={formatCurrency(p.total, { decimals: 2 })} />
              <Row label={p.withholdingLabel} value={`−${formatCurrency(p.withholdingAmount ?? 0, { decimals: 2 })}`} />
            </>
          ) : null}
          <View style={styles.grand}>
            <Text variant="subheading" tone="inverse">{p.withholdingLabel ? 'Ödenecek tutar' : 'Genel toplam'}</Text>
            <Text variant="subheading" tone="inverse" style={[styles.num, p.cancelled && { textDecorationLine: 'line-through' }]}>
              {formatCurrency(p.withholdingLabel ? (p.payableAmount ?? p.total) : p.total, { decimals: 2 })}
            </Text>
          </View>
        </View>

        {p.amountInWords || p.iban || p.note ? (
          <View style={styles.note}>
            <Text variant="caption" tone="tertiary">Açıklama</Text>
            {p.amountInWords ? <Text variant="label">{p.amountInWords}</Text> : null}
            {p.iban ? (
              <Text variant="bodySmall" tone="secondary">
                IBAN: {p.iban}
                {p.bankName ? ` (${p.bankName})` : ''}
              </Text>
            ) : null}
            {p.note ? <Text variant="bodySmall" tone="secondary">{p.note}</Text> : null}
          </View>
        ) : null}
      </View>
      {p.demo ? (
        <View pointerEvents="none" style={styles.stamp}>
          <Text style={styles.stampText}>{p.cancelled ? 'İPTAL' : DRAFT.stamp}</Text>
        </View>
      ) : null}
    </View>
  );
});

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text variant="bodySmall" tone="secondary">{label}</Text>
      <Text variant="label" style={styles.num}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  doc: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  demoBar: { backgroundColor: colors.ink, paddingVertical: 6, alignItems: 'center' },
  inner: { padding: spacing.lg, gap: spacing.lg },
  head: { flexDirection: 'row', justifyContent: 'space-between', paddingBottom: spacing.md, borderBottomWidth: 2, borderBottomColor: colors.ink, gap: spacing.md },
  parties: { flexDirection: 'row', gap: spacing.md },
  jobNo: { gap: 2, alignItems: 'flex-end', maxWidth: '40%' },
  lines: { borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.borderStrong },
  lineItem: { flexDirection: 'row', gap: spacing.md, paddingVertical: spacing.sm + 2 },
  lineBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  line: { flexDirection: 'row', gap: spacing.md, paddingVertical: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.borderStrong },
  totals: { gap: spacing.xs },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  grand: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: colors.ink, padding: spacing.md, borderRadius: radius.sm, marginTop: spacing.xs },
  num: { fontVariant: ['tabular-nums'] },
  note: { gap: 2, padding: spacing.md, borderRadius: radius.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.borderStrong },
  stamp: { position: 'absolute', top: '42%', left: 0, right: 0, alignItems: 'center', transform: [{ rotate: '-18deg' }] },
  stampText: { fontSize: 64, fontWeight: '800', letterSpacing: 12, color: 'rgba(11,11,12,0.05)' },
});
