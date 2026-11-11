import { Info } from 'lucide-react-native';
import { useRef, useState, type ComponentRef, type ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { colors, radius, spacing } from '@/theme';
import { Text } from './Text';

const BUBBLE_WIDTH = 280;
const EDGE = spacing.lg;

/**
 * Başlık veya alan adının yanındaki küçük "i" ikonu. Dokununca açıklama ikonun hemen altında küçük bir
 * balonda açılır; ekranda herhangi bir yere dokununca kapanır. Ekranda sürekli duran açıklama metinleri yerine.
 */
export function InfoTip({ text, label = 'Açıklama', size = 16, color = colors.textTertiary }: { text: string; label?: string; size?: number; color?: string }) {
  const anchor = useRef<ComponentRef<typeof Pressable>>(null);
  const [pos, setPos] = useState<{ x: number; y: number; h: number } | null>(null);
  const { width } = useWindowDimensions();

  const open = () => {
    anchor.current?.measureInWindow((x: number, y: number, w: number, h: number) => setPos({ x: x + w / 2, y, h }));
  };

  const bubbleWidth = Math.min(BUBBLE_WIDTH, width - EDGE * 2);
  const left = pos ? Math.min(Math.max(pos.x - bubbleWidth / 2, EDGE), width - EDGE - bubbleWidth) : 0;

  return (
    <>
      <Pressable
        ref={anchor}
        onPress={open}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint="Açıklamayı gösterir"
        style={({ pressed }) => [styles.icon, pressed && { opacity: 0.6 }]}>
        <Info size={size} color={color} />
      </Pressable>
      <Modal visible={!!pos} transparent animationType="fade" onRequestClose={() => setPos(null)} statusBarTranslucent>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setPos(null)} accessibilityLabel="Açıklamayı kapat">
          {pos ? (
            <View style={[styles.bubble, { top: pos.y + pos.h + spacing.xs, left, width: bubbleWidth }]} accessibilityLiveRegion="polite">
              <Text variant="bodySmall" tone="inverse">{text}</Text>
            </View>
          ) : null}
        </Pressable>
      </Modal>
    </>
  );
}

/** Başlık + yanında "i" ikonu; açıklama yoksa yalnızca başlık. */
export function LabelWithInfo({ children, info }: { children: ReactNode; info?: string }) {
  if (!info) return <>{children}</>;
  return (
    <View style={styles.row}>
      {children}
      <InfoTip text={info} />
    </View>
  );
}

const styles = StyleSheet.create({
  icon: { padding: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  bubble: {
    position: 'absolute',
    backgroundColor: colors.ink,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
});
