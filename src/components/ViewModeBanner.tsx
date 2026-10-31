import { ArrowLeftRight } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';
import { colors, radius, spacing } from '@/theme';

/** Yönetici şoför görünümündeyken gösterilir. */
export function ViewModeBanner() {
  const { user, viewMode, setViewMode } = useAuth();
  if (user?.role !== 'admin' || viewMode !== 'driver') return null;
  return (
    <Pressable
      onPress={() => setViewMode('admin')}
      style={({ pressed }) => [styles.banner, pressed && { opacity: 0.8 }]}
      accessibilityRole="button"
      accessibilityLabel="Yönetici görünümüne dön">
      <ArrowLeftRight size={18} color={colors.textInverse} />
      <View style={{ flex: 1 }}>
        <Text variant="subheading" tone="inverse">Yönetici görünümüne dön</Text>
        <Text variant="bodySmall" tone="inverseMuted">Şu an şoför görünümündesiniz. Rolünüz değişmez.</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.ink,
    borderRadius: radius.md,
    padding: spacing.md,
  },
});
