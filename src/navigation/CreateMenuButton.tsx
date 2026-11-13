import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { router } from 'expo-router';
import { ClipboardPlus, FileSignature, Plus, ReceiptText, type LucideIcon } from 'lucide-react-native';
import { Modal, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, { Easing, FadeIn, FadeInDown, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { ScalePressable } from '@/components/ui';
import { routes } from '@/navigation/routes';
import { colors, radius } from '@/theme';

const MENU_WIDTH = 200;
/** "+" simgesinin "×"e dönüşme süresi (ms). */
const ROTATE_DURATION = 320;

/**
 * Alt menünün ortasındaki siyah "+" butonu. Basınca hemen üstünde "Yeni iş", "Yeni fatura"
 * ve "Yeni teklif" seçeneklerini içeren küçük bir menü açılır; dışına dokununca kapanır. Açıkken "+" dönerek "×" olur.
 */
export function CreateMenuButton() {
  const ref = useRef<ComponentRef<typeof View>>(null);
  const { width, height } = useWindowDimensions();
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null);

  const open = () => ref.current?.measureInWindow((x: number, y: number, w: number) => setAnchor({ x: x + w / 2, y }));
  const close = () => setAnchor(null);
  const go = (href: Parameters<typeof router.push>[0]) => {
    close();
    router.push(href);
  };

  // Menü açılınca "+" 45° dönerek yumuşakça "×" olur, kapanınca geri döner.
  const rotation = useSharedValue(0);
  useEffect(() => {
    rotation.value = withTiming(anchor ? 45 : 0, { duration: ROTATE_DURATION, easing: Easing.out(Easing.cubic) });
  }, [anchor, rotation]);
  const iconStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotation.value}deg` }] }));

  const left = anchor ? Math.min(Math.max(anchor.x - MENU_WIDTH / 2, 12), width - MENU_WIDTH - 12) : 0;

  return (
    <>
      <View ref={ref} collapsable={false}>
        <ScalePressable
          onPress={anchor ? close : open}
          pressedScale={0.94}
          style={styles.fab}
          accessibilityRole="button"
          accessibilityLabel="Yeni oluştur"
          accessibilityState={{ expanded: !!anchor }}
        >
          <Animated.View style={iconStyle}>
            <Plus size={26} color={colors.textInverse} strokeWidth={2.5} />
          </Animated.View>
        </ScalePressable>
      </View>

      <Modal visible={!!anchor} transparent animationType="none" onRequestClose={close} statusBarTranslucent navigationBarTranslucent>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Menüyü kapat">
          <Animated.View entering={FadeIn.duration(150)} style={[StyleSheet.absoluteFill, styles.backdrop]} />
        </Pressable>
        {anchor && (
          <Animated.View entering={FadeInDown.duration(180)} style={[styles.menu, { left, bottom: height - anchor.y + 14 }]}>
            <MenuItem icon={ClipboardPlus} label="Yeni iş" onPress={() => go(routes.newJob())} />
            <View style={styles.divider} />
            <MenuItem icon={ReceiptText} label="Yeni fatura" onPress={() => go(routes.newInvoice())} />
            <View style={styles.divider} />
            <MenuItem icon={FileSignature} label="Yeni teklif" onPress={() => go(routes.newOffer())} />
          </Animated.View>
        )}
      </Modal>
    </>
  );
}

function MenuItem({ icon: Icon, label, onPress }: { icon: LucideIcon; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="menuitem" style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}>
      <View style={styles.itemIcon}>
        <Icon size={18} color={colors.text} strokeWidth={2} />
      </View>
      <Text style={styles.itemLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    width: 48,
    height: 48,
    borderRadius: radius.lg,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backdrop: { backgroundColor: 'rgba(0, 0, 0, 0.12)' },
  menu: {
    position: 'absolute',
    width: MENU_WIDTH,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 6,
    ...Platform.select({
      ios: { shadowColor: colors.ink, shadowOpacity: 0.16, shadowRadius: 18, shadowOffset: { width: 0, height: 6 } },
      android: { elevation: 10 },
      default: { boxShadow: '0 6px 18px rgba(0,0,0,0.16)' },
    }),
  },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 10, paddingVertical: 10, borderRadius: radius.md },
  itemPressed: { backgroundColor: colors.background },
  itemIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemLabel: { fontSize: 15, fontWeight: '600', color: colors.text },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginHorizontal: 10 },
});
