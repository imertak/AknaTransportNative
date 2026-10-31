import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { BrandMark } from '@/components/BrandMark';
import { Text } from '@/components/ui';
import { colors, spacing } from '@/theme';

/** Oturum kontrolü sırasında gösterilen marka ekranı. */
export default function SplashScreen() {
  return (
    <View style={styles.root} accessibilityLabel="AKNA Transport yükleniyor">
      <BrandMark />
      <View style={styles.bottom}>
        <ActivityIndicator color={colors.textInverseMuted} />
        <Text variant="caption" tone="inverseMuted">Oturum kontrol ediliyor</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  bottom: { position: 'absolute', bottom: 64, alignItems: 'center', gap: spacing.md },
});
