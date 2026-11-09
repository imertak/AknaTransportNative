import { router, useFocusEffect } from 'expo-router';
import { Ban, Bell, CheckCheck, CircleCheck, ClipboardList, PackageOpen, PencilLine, Truck, UserRoundMinus, type LucideIcon } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import { EmptyState, ErrorState, IconButton, LoadingState, MonthHeader, monthSeparator, NavHeader, Screen, Text } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/contexts/NotificationContext';
import { routes } from '@/navigation/routes';
import { errorMessage } from '@/services/errors';
import { notificationService, type AppNotification, type NotificationKind } from '@/services/notifications';
import { colors, radius, spacing } from '@/theme';
import { formatRelative } from '@/utils/format';
import { groupByMonth, monthRowKey, type MonthRow } from '@/utils/monthGroups';

const ICONS: Record<NotificationKind, LucideIcon> = {
  JobAssigned: ClipboardList,
  JobUnassigned: UserRoundMinus,
  JobUpdated: PencilLine,
  JobCancelled: Ban,
  JobAccepted: CircleCheck,
  JobStarted: Truck,
  JobLoading: PackageOpen,
  JobDelivering: Truck,
  JobCompleted: CheckCheck,
};

/** Bildirimler: iş atandı, iptal edildi, şoför yola çıktı vb. Dokununca ilgili iş açılır. */
export default function NotificationsScreen() {
  const { viewMode } = useAuth();
  const { setUnreadCount } = useNotifications();
  const [items, setItems] = useState<AppNotification[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const list = await notificationService.list();
      setItems(list);
      setError(null);
      setUnreadCount(list.filter((n) => !n.isRead).length);
    } catch (e) {
      setError(errorMessage(e, 'Bildirimler yüklenemedi.'));
    }
  }, [setUnreadCount]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const open = useCallback(
    (n: AppNotification) => {
      if (!n.isRead) {
        setItems((list) => {
          const next = list?.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)) ?? null;
          setUnreadCount(next?.filter((x) => !x.isRead).length ?? 0);
          return next;
        });
        notificationService.markRead(n.id).catch(() => {});
      }
      if (n.jobId && n.type !== 'JobUnassigned') router.push(routes.job(n.jobId, viewMode));
    },
    [setUnreadCount, viewMode],
  );

  const markAll = useCallback(async () => {
    setItems((list) => list?.map((x) => ({ ...x, isRead: true })) ?? null);
    setUnreadCount(0);
    await notificationService.markAllRead().catch(() => {});
  }, [setUnreadCount]);

  const hasUnread = !!items?.some((n) => !n.isRead);
  const rows = useMemo(() => groupByMonth(items ?? [], (n) => n.createdAt, (n) => n.id), [items]);

  return (
    <Screen>
      <NavHeader
        title="Bildirimler"
        right={hasUnread ? <IconButton icon={CheckCheck} label="Tümünü okundu yap" tone="dark" onPress={markAll} /> : undefined}
      />
      {items === null && !error ? (
        <LoadingState />
      ) : error && !items ? (
        <ErrorState message={error} onRetry={load} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={monthRowKey}
          renderItem={({ item, index }: { item: MonthRow<AppNotification>; index: number }) =>
            item.kind === 'month' ? <MonthHeader label={item.label} first={index === 0} /> : <NotificationRow item={item.item} onPress={open} />
          }
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={Separator}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.textTertiary} />}
          ListEmptyComponent={<EmptyState icon={Bell} title="Bildirim yok" description="İş atandığında veya durumu değiştiğinde burada görünür." />}
        />
      )}
    </Screen>
  );
}

function NotificationRow({ item, onPress }: { item: AppNotification; onPress: (n: AppNotification) => void }) {
  const Icon = ICONS[item.type] ?? Bell;
  return (
    <Pressable
      onPress={() => onPress(item)}
      accessibilityRole="button"
      accessibilityLabel={`${item.title}. ${item.body}${item.isRead ? '' : '. Okunmadı'}`}
      style={({ pressed }) => [styles.row, !item.isRead && styles.unread, pressed && { opacity: 0.85 }]}>
      <View style={[styles.icon, !item.isRead && styles.iconUnread]}>
        <Icon size={18} color={item.isRead ? colors.text : colors.textInverse} />
      </View>
      <View style={styles.texts}>
        <View style={styles.titleRow}>
          <Text variant="subheading" style={styles.title} numberOfLines={1}>{item.title}</Text>
          <Text variant="caption" tone="tertiary">{formatRelative(new Date(item.createdAt).getTime())}</Text>
        </View>
        <Text variant="bodySmall" tone="secondary" numberOfLines={3}>{item.body}</Text>
      </View>
      {!item.isRead ? <View style={styles.dot} /> : null}
    </Pressable>
  );
}

const Separator = monthSeparator(spacing.sm);

const styles = StyleSheet.create({
  list: { padding: spacing.lg, paddingBottom: spacing.huge, flexGrow: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  unread: { borderColor: colors.borderStrong },
  icon: { width: 36, height: 36, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceSunken },
  iconUnread: { backgroundColor: colors.ink },
  texts: { flex: 1, gap: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { flex: 1 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.ink, marginTop: 6 },
});
