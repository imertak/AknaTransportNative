import { LocateFixed, MapPinOff, X } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, View } from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT, type MapPressEvent, type MarkerDragStartEndEvent } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Text } from '@/components/ui';
import { errorMessage } from '@/services/errors';
import { geocodeAddress, mapAvailability } from '@/services/geocoding';
import { colors, radius, spacing } from '@/theme';
import type { GeoPoint } from '@/types';
import { ISTANBUL_CENTER } from '@/utils/geo';
import type { AddressMapModalProps } from './AddressMapModal.types';

type Phase = { kind: 'searching' } | { kind: 'found' } | { kind: 'not_found' } | { kind: 'error'; message: string };

/**
 * Adresi haritada kontrol etme: adres aranır, bulunan konuma pin konur, kullanıcı pini
 * sürükleyerek veya haritaya dokunarak düzeltir ve onaylar. Adres bulunamazsa açık bir
 * hata gösterilir; pin yalnızca kullanıcı haritada bir nokta seçerse oluşur.
 */
export function AddressMapModal(props: AddressMapModalProps) {
  const { visible, address, initialPoint, onClose } = props;
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="fullScreen">
      {/* Her açılışta seçici sıfırdan kurulur: önceki aramanın durumu taşınmaz. */}
      {visible ? <MapPicker key={`${address}|${initialPoint?.latitude ?? ''}|${initialPoint?.longitude ?? ''}`} {...props} /> : null}
    </Modal>
  );
}

function MapPicker({ address, initialPoint, onClose, onConfirm }: AddressMapModalProps) {
  const insets = useSafeAreaInsets();
  const availability = mapAvailability();
  const mapRef = useRef<MapView>(null);
  const [pin, setPin] = useState<GeoPoint | null>(initialPoint ?? null);
  const [phase, setPhase] = useState<Phase>(initialPoint || !availability.available ? { kind: 'found' } : { kind: 'searching' });

  const applyResult = (found: GeoPoint | null) => {
    if (found) {
      setPin(found);
      setPhase({ kind: 'found' });
      mapRef.current?.animateToRegion({ ...found, latitudeDelta: 0.01, longitudeDelta: 0.01 }, 350);
    } else {
      setPin(null);
      setPhase({ kind: 'not_found' });
    }
  };
  const applyError = (e: unknown) => setPhase({ kind: 'error', message: errorMessage(e, 'Adres aranamadı.') });

  const search = () => {
    setPhase({ kind: 'searching' });
    geocodeAddress(address).then(applyResult, applyError);
  };

  // Kayıtlı konum yoksa açılışta adres aranır.
  useEffect(() => {
    if (initialPoint || !availability.available) return;
    let alive = true;
    geocodeAddress(address).then(
      (p) => alive && applyResult(p),
      (e) => alive && applyError(e),
    );
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const place = (p: GeoPoint) => {
    setPin(p);
    setPhase({ kind: 'found' });
  };

  const center = pin ?? initialPoint ?? ISTANBUL_CENTER;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text variant="heading" tone="inverse">
            Haritada kontrol et
          </Text>
          <Text variant="bodySmall" tone="inverseMuted" numberOfLines={2}>
            {address}
          </Text>
        </View>
        <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Kapat" style={styles.close}>
          <X size={20} color={colors.textInverse} />
        </Pressable>
      </View>

      {!availability.available ? (
        <View style={styles.unavailable}>
          <MapPinOff size={28} color={colors.textTertiary} />
          <Text variant="subheading" align="center">
            Harita kullanılamıyor
          </Text>
          <Text variant="bodySmall" tone="secondary" align="center">
            {availability.reason}
          </Text>
          <Button label="Kapat" variant="secondary" onPress={onClose} />
        </View>
      ) : (
        <>
          <View style={styles.mapWrap}>
            <MapView
              ref={mapRef}
              style={StyleSheet.absoluteFill}
              provider={PROVIDER_DEFAULT}
              initialRegion={{ ...center, latitudeDelta: pin ? 0.01 : 0.35, longitudeDelta: pin ? 0.01 : 0.35 }}
              onPress={(e: MapPressEvent) => place(e.nativeEvent.coordinate)}
              showsPointsOfInterests={false}
              toolbarEnabled={false}
              userInterfaceStyle="light"
            >
              {pin ? (
                <Marker
                  coordinate={pin}
                  draggable
                  onDragEnd={(e: MarkerDragStartEndEvent) => place(e.nativeEvent.coordinate)}
                  pinColor={colors.ink}
                  title={address}
                />
              ) : null}
            </MapView>
            {phase.kind === 'searching' ? (
              <View style={styles.searching}>
                <ActivityIndicator color={colors.text} />
                <Text variant="bodySmall">Adres aranıyor…</Text>
              </View>
            ) : null}
          </View>

          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
            {phase.kind === 'not_found' ? (
              <View style={styles.alert} accessibilityRole="alert">
                <Text variant="subheading" tone="danger">
                  Adres bulunamadı
                </Text>
                <Text variant="bodySmall" tone="secondary">
                  Adresi daha ayrıntılı yazmayı (ilçe, mahalle) deneyin veya doğru noktaya haritada dokunarak pini kendiniz yerleştirin.
                </Text>
              </View>
            ) : phase.kind === 'error' ? (
              <View style={styles.alert} accessibilityRole="alert">
                <Text variant="subheading" tone="danger">
                  Adres aranamadı
                </Text>
                <Text variant="bodySmall" tone="secondary">
                  {phase.message}
                </Text>
              </View>
            ) : pin ? (
              <Text variant="bodySmall" tone="secondary">
                Pini sürükleyerek veya haritaya dokunarak konumu düzeltebilirsiniz. {pin.latitude.toFixed(5)}, {pin.longitude.toFixed(5)}
              </Text>
            ) : null}
            <View style={styles.row}>
              <Button label="Tekrar ara" variant="secondary" icon={LocateFixed} onPress={search} style={{ flex: 1 }} disabled={phase.kind === 'searching'} />
              <Button
                label="Konumu kaydet"
                onPress={() => {
                  if (pin) onConfirm(pin);
                }}
                disabled={!pin}
                style={{ flex: 1.4 }}
              />
            </View>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  close: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.inkRaised, alignItems: 'center', justifyContent: 'center' },
  mapWrap: { flex: 1, backgroundColor: colors.surfaceSunken },
  searching: {
    position: 'absolute',
    top: spacing.lg,
    alignSelf: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
  },
  footer: { backgroundColor: colors.surface, padding: spacing.lg, gap: spacing.md },
  alert: { gap: 2 },
  row: { flexDirection: 'row', gap: spacing.sm },
  unavailable: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xxl },
});
