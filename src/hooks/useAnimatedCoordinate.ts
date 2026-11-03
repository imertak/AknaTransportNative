import { useEffect, useRef, useState } from 'react';

import type { GeoPoint } from '@/types';
import { distanceMeters } from '@/utils/geo';

const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
/** Bu mesafeden uzun sıçramalar (ör. uzun çevrimdışı süre) animasyonsuz uygulanır. */
const SNAP_METERS = 3000;

/**
 * Hedef koordinata yumuşak geçiş: araç işaretçisi yeni konuma "sürülerek" ilerler. Yalnızca bu hook'u
 * kullanan işaretçi yeniden çizilir; harita ve diğer işaretçiler etkilenmez.
 */
export function useAnimatedCoordinate(target: GeoPoint, durationMs: number): GeoPoint {
  const [current, setCurrent] = useState(target);
  const currentRef = useRef(target);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    const from = currentRef.current;
    if (from.latitude === target.latitude && from.longitude === target.longitude) return;
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    if (distanceMeters(from, target) > SNAP_METERS || durationMs <= 0) {
      currentRef.current = target;
      setCurrent(target);
      return;
    }
    const start = Date.now();
    const step = () => {
      const t = Math.min(1, (Date.now() - start) / durationMs);
      const k = easeInOut(t);
      const next = {
        latitude: from.latitude + (target.latitude - from.latitude) * k,
        longitude: from.longitude + (target.longitude - from.longitude) * k,
      };
      currentRef.current = next;
      setCurrent(next);
      frame.current = t < 1 ? requestAnimationFrame(step) : null;
    };
    frame.current = requestAnimationFrame(step);
    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      frame.current = null;
    };
  }, [target.latitude, target.longitude, durationMs]); // eslint-disable-line react-hooks/exhaustive-deps

  return current;
}
