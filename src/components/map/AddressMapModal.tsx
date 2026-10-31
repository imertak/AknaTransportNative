import { X } from 'lucide-react-native';
import { Linking, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';

interface Props {
  visible: boolean;
  address: string;
  onClose: () => void;
}

/** Adres için harita bağlantısı gösteren küçük modal. */
export function AddressMapModal({ visible, address, onClose }: Props) {
  const encoded = encodeURIComponent(address);
  const mapUrl = Platform.select({
    ios: `maps:?q=${encoded}`,
    android: `geo:0,0?q=${encoded}`,
    default: `https://www.google.com/maps/search/?api=1&query=${encoded}`,
  });

  const openMap = () => {
    Linking.openURL(mapUrl!).catch(() => {});
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text variant="heading" style={{ flex: 1 }}>Adres Konumu</Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <X size={20} color={colors.text} />
            </Pressable>
          </View>
          <View style={styles.body}>
            <Text variant="body" style={{ marginBottom: spacing.md }}>{address}</Text>
            <View style={styles.mapPlaceholder}>
              <Text variant="bodySmall" tone="secondary" align="center">
                Harita önizlemesi için Google Maps API anahtarı gereklidir.{'\n'}
                Aşağıdaki butona tıklayarak harita uygulamasında açabilirsiniz.
              </Text>
            </View>
            <Pressable onPress={openMap} style={({ pressed }) => [styles.mapButton, pressed && { opacity: 0.8 }]}>
              <Text variant="subheading" tone="inverse" align="center">Haritada Aç</Text>
            </Pressable>
          </View>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  container: { backgroundColor: colors.surface, borderRadius: radius.lg, width: '100%', maxWidth: 400, maxHeight: '80%', overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border },
  body: { padding: spacing.lg },
  mapPlaceholder: { backgroundColor: '#F5F5F5', borderRadius: radius.md, padding: spacing.xxl, alignItems: 'center', justifyContent: 'center', minHeight: 150, marginBottom: spacing.lg },
  mapButton: { backgroundColor: '#000000', borderRadius: radius.md, padding: spacing.md },
});
