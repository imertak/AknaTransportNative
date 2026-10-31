import { Linking, Platform } from 'react-native';

import type { GeoPoint } from '@/types';

/** Cihazın harita uygulamasında yol tarifi açar. */
export function openDirections(address: string, point?: GeoPoint) {
  const q = point ? `${point.latitude},${point.longitude}` : encodeURIComponent(address);
  const url = Platform.select({
    ios: `http://maps.apple.com/?daddr=${q}`,
    android: `google.navigation:q=${q}`,
    default: `https://www.google.com/maps/dir/?api=1&destination=${q}`,
  });
  Linking.openURL(url).catch(() => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${q}`).catch(() => {}));
}

export const callPhone = (phone: string) => Linking.openURL(`tel:${phone.replace(/[^\d+]/g, '')}`).catch(() => {});
export const sendEmail = (email: string) => Linking.openURL(`mailto:${email}`).catch(() => {});
