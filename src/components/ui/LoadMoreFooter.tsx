import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { spacing } from '@/theme';
import { Button } from './Button';
import { Text } from './Text';

/** Sayfalı listenin altı: kaçının gösterildiği ve sonraki sayfa butonu. */
export const LoadMoreFooter = memo(function LoadMoreFooter({ shown, total, unit, onMore }: { shown: number; total: number; unit: string; onMore: () => void }) {
  if (total === 0) return null;
  const hasMore = shown < total;
  return (
    <View style={styles.wrap}>
      <Text variant="bodySmall" tone="tertiary" align="center">
        {hasMore ? `${total} ${unit} içinden ${shown} tanesi gösteriliyor` : `${total} ${unit} listelendi`}
      </Text>
      {hasMore ? <Button label="Daha fazla göster" variant="secondary" size="sm" onPress={onMore} /> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { marginTop: spacing.lg, gap: spacing.sm, alignItems: 'center' },
});
