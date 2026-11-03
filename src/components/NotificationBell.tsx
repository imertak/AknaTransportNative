import { router } from 'expo-router';
import { Bell } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { IconButton, Text } from '@/components/ui';
import { useNotifications } from '@/contexts/NotificationContext';
import { routes } from '@/navigation/routes';
import { colors } from '@/theme';
import type { ViewMode } from '@/types';

/** Başlıktaki zil: okunmamış bildirim sayısını rozet olarak gösterir. */
export function NotificationBell({ mode }: { mode: ViewMode }) {
  const { unreadCount } = useNotifications();
  const label = unreadCount > 0 ? `Bildirimler, ${unreadCount} okunmamış` : 'Bildirimler';
  return (
    <View>
      <IconButton icon={Bell} label={label} tone="dark" onPress={() => router.push(routes.notifications(mode))} />
      {unreadCount > 0 ? (
        <View style={styles.badge} pointerEvents="none">
          <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -5,
    right: -5,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.ink,
  },
  badgeText: { color: colors.textInverse, fontSize: 10, fontWeight: '700', lineHeight: 12 },
});
