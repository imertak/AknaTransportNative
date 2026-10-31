import { CalendarDays, Truck, UserRound } from 'lucide-react-native';
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { Card, StatusBadge, Text } from '@/components/ui';
import { VEHICLE_TYPE_LABEL } from '@/constants/vehicles';
import { colors, spacing } from '@/theme';
import type { TransportJob } from '@/types';
import { formatCurrency, formatDate } from '@/utils/format';
import { RouteLine } from './RouteLine';

interface Props {
  job: TransportJob;
  onPress: (job: TransportJob) => void;
  showPrice?: boolean;
  driverName?: string;
}

export const JobCard = memo(function JobCard({ job, onPress, showPrice, driverName }: Props) {
  return (
    <Card onPress={() => onPress(job)} accessibilityLabel={`${job.jobNo} ${job.customerName}`} style={styles.card}>
      <View style={styles.top}>
        <Text variant="caption" tone="tertiary">{job.jobNo}</Text>
        <StatusBadge status={job.status} />
      </View>
      <Text variant="heading" numberOfLines={1}>{job.customerName}</Text>
      <View style={styles.meta}>
        <View style={styles.metaItem}>
          <CalendarDays size={14} color={colors.textTertiary} />
          <Text variant="bodySmall" tone="secondary">{formatDate(job.date)}</Text>
        </View>
        <View style={styles.metaItem}>
          <Truck size={14} color={colors.textTertiary} />
          <Text variant="bodySmall" tone="secondary">{VEHICLE_TYPE_LABEL[job.vehicleType]}</Text>
        </View>
      </View>
      <View style={styles.route}>
        <RouteLine pickup={job.pickupAddress} delivery={job.deliveryAddress} compact />
      </View>
      {showPrice || driverName !== undefined ? (
        <View style={styles.footer}>
          <View style={styles.metaItem}>
            <UserRound size={14} color={colors.textTertiary} />
            <Text variant="bodySmall" tone={driverName ? 'secondary' : 'tertiary'} numberOfLines={1}>
              {driverName ?? 'Atanmadı'}
            </Text>
          </View>
          {showPrice ? <Text variant="subheading" style={styles.price}>{formatCurrency(job.price)}</Text> : null}
        </View>
      ) : null}
    </Card>
  );
});

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  meta: { flexDirection: 'row', gap: spacing.lg, flexWrap: 'wrap' },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  route: { marginTop: spacing.xs, padding: spacing.md, backgroundColor: colors.surfaceMuted, borderRadius: 12 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.xs, gap: spacing.md },
  price: { fontVariant: ['tabular-nums'] },
});
