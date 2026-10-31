import { ArrowLeftRight } from 'lucide-react-native';
import { Pressable, StyleSheet } from 'react-native';

import { Text } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';
import { colors, radius, spacing } from '@/theme';

/** Yönetici şoför görünümündeyken gösterilir. */
export function ViewModeBanner() {
  const { user, viewMode, setViewMode } = useAuth();
  if (user?.role !== 'admin' || viewMode !== 'driver') return null;
  return (
    <Pressable onPress={() => setViewMode('admin')} style={({ pressed }) => [styles.banner, pressed && { opacity: 0.8 }]} accessibilityRole="button">
      <ArrowLeftRight size={16} color={colors.text} />
      <Text variant="bodySmall" style={{ flex: 1 }}>
        Şoför görünümündesiniz. Yönetici paneline dönmek için dokunun.
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    padding: spacing.md,
  },
});
