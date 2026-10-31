import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { JOB_STATUS_LABEL } from '@/constants/jobStatus';
import { colors, spacing } from '@/theme';
import type { JobStatusEvent, User } from '@/types';
import { formatDateTime } from '@/utils/format';

export const StatusTimeline = memo(function StatusTimeline({ events, users }: { events: JobStatusEvent[]; users: Map<string, User> }) {
  const list = [...events].reverse();
  return (
    <View>
      {list.map((e, i) => (
        <View key={`${e.status}-${e.at}-${i}`} style={styles.row}>
          <View style={styles.rail}>
            <View style={[styles.dot, i === 0 && styles.dotActive]} />
            {i < list.length - 1 ? <View style={styles.line} /> : null}
          </View>
          <View style={styles.body}>
            <Text variant="subheading" tone={i === 0 ? 'default' : 'secondary'}>{JOB_STATUS_LABEL[e.status]}</Text>
            <Text variant="bodySmall" tone="tertiary">
              {formatDateTime(e.at)} · {users.get(e.byUserId)?.fullName ?? 'Sistem'}
            </Text>
            {e.note ? <Text variant="bodySmall" tone="secondary">{e.note}</Text> : null}
          </View>
        </View>
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.md },
  rail: { alignItems: 'center', width: 12 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.borderStrong, marginTop: 5 },
  dotActive: { backgroundColor: colors.ink },
  line: { flex: 1, width: 1.5, backgroundColor: colors.border, marginVertical: 2 },
  body: { flex: 1, paddingBottom: spacing.lg, gap: 2 },
});
