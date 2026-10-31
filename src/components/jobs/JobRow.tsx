import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { StatusBadge, Text } from '@/components/ui';
import { colors, spacing } from '@/theme';
import type { TransportJob } from '@/types';
import { formatCurrency, formatDateShort } from '@/utils/format';

/** Kart içindeki yoğun liste satırı (dashboard, müşteri geçmişi). */
export const JobRow = memo(function JobRow({ job, onPress, showPrice = true, last }: { job: TransportJob; onPress: (job: TransportJob) => void; showPrice?: boolean; last?: boolean }) {
  return (
    <Pressable
      onPress={() => onPress(job)}
      accessibilityRole="button"
      accessibilityLabel={`${job.jobNo} ${job.customerName}`}
      style={({ pressed }) => [styles.row, !last && styles.border, pressed && { opacity: 0.6 }]}>
      <View style={styles.date}>
        <Text variant="label">{formatDateShort(job.date)}</Text>
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="subheading" numberOfLines={1}>{job.customerName}</Text>
        <Text variant="bodySmall" tone="secondary" numberOfLines={1}>{job.description}</Text>
      </View>
      <View style={styles.right}>
        {showPrice ? <Text variant="subheading" style={{ fontVariant: ['tabular-nums'] }}>{formatCurrency(job.price)}</Text> : null}
        <StatusBadge status={job.status} />
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  border: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderStrong },
  date: { width: 52, height: 44, borderRadius: 10, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  right: { alignItems: 'flex-end', gap: 6 },
});
