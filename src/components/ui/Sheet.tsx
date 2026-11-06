import { X } from 'lucide-react-native';
import { useEffect, useState, type ReactNode } from 'react';
import { Keyboard, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radius, spacing } from '@/theme';
import { IconButton } from './IconButton';
import { Text } from './Text';

interface Props {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}

/**
 * Klavye yüksekliği. Android edge-to-edge çalıştığı için pencere klavyede yeniden boyutlanmaz ve
 * KeyboardAvoidingView Modal içinde perdeyi yukarı itmez; perdeyi klavyenin üstüne bu değerle taşırız.
 */
function useKeyboardHeight(active: boolean) {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    if (!active) return;
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvent, (e) => setHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener(hideEvent, () => setHeight(0));
    return () => {
      show.remove();
      hide.remove();
      setHeight(0);
    };
  }, [active]);
  return active ? height : 0;
}

/** Alt sayfa (bottom sheet). Seçim listeleri, filtreler ve onaylar için. */
export function Sheet({ visible, onClose, title, subtitle, children, footer }: Props) {
  const insets = useSafeAreaInsets();
  const keyboardHeight = useKeyboardHeight(visible);
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <View style={[styles.root, { paddingBottom: keyboardHeight }]}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Kapat" />
        <View style={styles.frame}>
          <View style={[styles.sheet, { paddingBottom: keyboardHeight > 0 ? spacing.lg : Math.max(insets.bottom, spacing.lg) }]}>
            <View style={styles.grabber} />
            <View style={styles.header}>
              <View style={{ flex: 1 }}>
                <Text variant="heading">{title}</Text>
                {subtitle ? <Text variant="bodySmall" tone="secondary">{subtitle}</Text> : null}
              </View>
              <IconButton icon={X} label="Kapat" onPress={onClose} tone="plain" size={36} />
            </View>
            <View style={styles.body}>{children}</View>
            {footer ? <View style={styles.footer}>{footer}</View> : null}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: colors.overlay },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    flexShrink: 1,
    paddingTop: spacing.sm,
  },
  // Yükseklik sınırı yüksekliği belli olan dış kapta tutulur; yüzde, içeriğe göre boyutlanan kapta güvenilir çözülmez.
  frame: { maxHeight: '90%' },
  grabber: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong, marginBottom: spacing.sm },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.xl, paddingBottom: spacing.md, gap: spacing.md },
  body: { flexShrink: 1 },
  footer: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, gap: spacing.sm },
});
