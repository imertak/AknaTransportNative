import { MapPinOff, X } from 'lucide-react-native';
import { Linking, Modal, Pressable, StyleSheet, View } from 'react-native';

import { Button, Text } from '@/components/ui';
import { mapAvailability } from '@/services/geocoding';
import { colors, radius, spacing } from '@/theme';
import type { AddressMapModalProps } from './AddressMapModal.types';

/**
 * Web önizlemesinde yerel harita ve geocoder yoktur. Sahte harita veya koordinat
 * gösterilmez; yalnızca durum açıklanır ve adres harici haritada açılabilir.
 */
export function AddressMapModal({ visible, address, initialPoint, onClose }: AddressMapModalProps) {
  const availability = mapAvailability();
  const reason = availability.available ? '' : availability.reason;
  const openExternal = () =>
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`).catch(() => {});

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text variant="heading" style={{ flex: 1 }}>Haritada kontrol et</Text>
            <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Kapat">
              <X size={20} color={colors.text} />
            </Pressable>
          </View>
          <View style={styles.body}>
            <Text variant="subheading">{address}</Text>
            <View style={styles.notice}>
              <MapPinOff size={20} color={colors.textSecondary} />
              <Text variant="bodySmall" tone="secondary" style={{ flex: 1 }}>{reason}</Text>
            </View>
            {initialPoint ? (
              <Text variant="bodySmall" tone="secondary">
                Kayıtlı konum: {initialPoint.latitude.toFixed(5)}, {initialPoint.longitude.toFixed(5)}
              </Text>
            ) : (
              <Text variant="bodySmall" tone="tertiary">Bu adres için kayıtlı konum yok.</Text>
            )}
            <Button label="Adresi Google Haritalar'da aç" variant="secondary" onPress={openExternal} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  container: { backgroundColor: colors.surface, borderRadius: radius.lg, width: '100%', maxWidth: 440, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border },
  body: { padding: spacing.lg, gap: spacing.md },
  notice: { flexDirection: 'row', gap: spacing.sm, backgroundColor: colors.surfaceSunken, borderRadius: radius.md, padding: spacing.md, alignItems: 'flex-start' },
});
