import { FileSignature } from 'lucide-react-native';
import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { colors, spacing } from '@/theme';
import type { OfferListItem } from '@/types/offers';
import { formatCurrency, formatDate } from '@/utils/format';
import { OfferStatusBadge } from './OfferStatusBadge';

/** Teklif listesi satırı: müşteri, teklif no, güzergâh, tutar ve durum. */
export const OfferRow = memo(function OfferRow({ offer, onPress, last }: { offer: OfferListItem; onPress: (o: OfferListItem) => void; last?: boolean }) {
  const closed = offer.status === 'Cancelled' || offer.status === 'Rejected';
  return (
    <Pressable
      onPress={() => onPress(offer)}
      accessibilityRole="button"
      accessibilityLabel={`${offer.offerNumber} ${offer.customerName}`}
      style={({ pressed }) => [styles.row, !last && styles.border, pressed && { backgroundColor: colors.surfaceMuted }]}>
      <View style={styles.icon}>
        <FileSignature size={18} color={colors.textSecondary} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="subheading" numberOfLines={1}>{offer.customerName}</Text>
        <Text variant="bodySmall" tone="secondary" numberOfLines={1}>
          {offer.offerNumber} · {formatDate(offer.offerDate)}
        </Text>
        <Text variant="bodySmall" tone="tertiary" numberOfLines={1}>
          {offer.loadingPoint} → {offer.unloadingPoint}
        </Text>
      </View>
      <View style={styles.right}>
        <Text variant="subheading" style={[{ fontVariant: ['tabular-nums'] }, closed && styles.strike]}>
          {formatCurrency(offer.totalAmount, { decimals: 2 })}
        </Text>
        <OfferStatusBadge status={offer.status} style={styles.badge} />
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
