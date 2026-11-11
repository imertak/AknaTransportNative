import { ReceiptText } from 'lucide-react-native';
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { colors } from '@/theme';

/** Faturalandırılmış iş: durum etiketinin yanında yeşil fatura simgesi. */
export const InvoicedMark = memo(function InvoicedMark() {
  return (
    <View style={styles.mark} accessible accessibilityRole="image" accessibilityLabel="Faturalandırıldı">
      <ReceiptText size={14} color={colors.textInverse} strokeWidth={2.2} />
    </View>
  );
});

const styles = StyleSheet.create({
  mark: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.success, alignItems: 'center', justifyContent: 'center' },
});
