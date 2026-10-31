import { ReceiptText } from 'lucide-react-native';
import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { colors, spacing } from '@/theme';
import type { Invoice } from '@/types';
import { formatCurrency, formatDate } from '@/utils/format';
import { InvoiceStatusBadge } from './InvoiceStatusBadge';

export const InvoiceRow = memo(function InvoiceRow({ invoice, onPress, showCustomer, last }: { invoice: Invoice; onPress: (inv: Invoice) => void; showCustomer?: boolean; last?: boolean }) {
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
          {formatDate(invoice.issueDate)} · {invoice.jobNo}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 4 }}>
        <Text variant="subheading" style={[{ fontVariant: ['tabular-nums'] }, invoice.status === 'cancelled' && styles.strike]}>
          {formatCurrency(invoice.total, { decimals: 2 })}
        </Text>
        <InvoiceStatusBadge invoice={invoice} />
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg },
  border: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderStrong },
  icon: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  strike: { textDecorationLine: 'line-through', color: colors.textTertiary },
});
