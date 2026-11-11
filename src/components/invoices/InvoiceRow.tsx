import { ReceiptText } from 'lucide-react-native';
import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { colors, spacing } from '@/theme';
import type { Invoice } from '@/types';
import { formatCurrency, formatDate } from '@/utils/format';
import { InvoiceStatusBadge } from './InvoiceStatusBadge';

export const InvoiceRow = memo(function InvoiceRow({ invoice, onPress, showCustomer, last }: { invoice: Invoice; onPress: (inv: Invoice) => void; showCustomer?: boolean; last?: boolean }) {
  // Tevkifatlı faturada müşterinin ödeyeceği tutar (genel toplam − tevkifat) gösterilir.
  const withheld = !!invoice.withholdingCode && (invoice.withholdingAmount ?? 0) > 0;
  const amount = withheld ? (invoice.payableAmount ?? invoice.total) : invoice.total;
  return (
    <Pressable
      onPress={() => onPress(invoice)}
      accessibilityRole="button"
      accessibilityLabel={invoice.invoiceNo}
      style={({ pressed }) => [styles.row, !last && styles.border, pressed && { backgroundColor: colors.surfaceMuted }]}>
      <View style={styles.icon}>
        <ReceiptText size={18} color={colors.textSecondary} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="subheading" numberOfLines={1}>{showCustomer ? invoice.customerName : invoice.invoiceNo}</Text>
        <Text variant="bodySmall" tone="secondary" numberOfLines={1}>
          {showCustomer ? `${invoice.invoiceNo} · ` : ''}
          {formatDate(invoice.issueDate)} · {(invoice.jobCount ?? 1) > 1 ? `${invoice.jobCount} iş` : invoice.jobNo}
        </Text>
      </View>
      <View style={styles.right}>
        <Text variant="subheading" style={[{ fontVariant: ['tabular-nums'] }, invoice.status === 'cancelled' && styles.strike]}>
          {formatCurrency(amount, { decimals: 2 })}
        </Text>
        {/* Rozet varsayılan olarak sola yaslanır; tutarla aynı sağ hizada dursun. */}
        <InvoiceStatusBadge invoice={invoice} style={styles.badge} />
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg },
  border: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderStrong },
  icon: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  right: { alignItems: 'flex-end', gap: 6, flexShrink: 0 },
  badge: { alignSelf: 'flex-end' },
  strike: { textDecorationLine: 'line-through', color: colors.textTertiary },
});
