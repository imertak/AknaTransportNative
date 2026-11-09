import { useEffect, useMemo, useState } from 'react';

import type { MapRoute } from '@/components/map/types';
import { fetchRoute } from '@/services/routing';
import type { GeoPoint } from '@/types';
import { distanceMeters } from '@/utils/geo';

/** Araç rotanın başladığı noktadan bu kadar uzaklaşınca yol yeniden hesaplanır. */
const REROUTE_METERS = 150;

const pointKey = (p: GeoPoint) => `${p.latitude.toFixed(5)},${p.longitude.toFixed(5)}`;

/** Yolun araca en yakın noktasından sonrası: araç ilerledikçe geride kalan kısım çizilmez. */
function remaining(coords: GeoPoint[], from: GeoPoint): GeoPoint[] {
  let best = 0;
  let bestDistance = Infinity;
  for (let i = 0; i < coords.length; i++) {
    const d = distanceMeters(from, coords[i]!);
    if (d < bestDistance) {
      bestDistance = d;
      best = i;
    }
  }
  return [from, ...coords.slice(best + 1)];
}

/**
 * Araçtan gidilen durağa kalan yol. Yol, araç her konum gönderdiğinde değil, rotanın başladığı noktadan
 * 150 m uzaklaşınca veya hedef değişince yeniden istenir. Yol servisine ulaşılamazsa düz (kesikli) çizgi döner.
 */
export function useLegRoute(from: GeoPoint | null | undefined, to: GeoPoint | null | undefined): MapRoute | null {
  const toKey = to ? pointKey(to) : '';
  // Rotanın istendiği araç konumu; araç uzaklaşınca veya hedef değişince güncellenir (render sırasında türetilir).
  const [origin, setOrigin] = useState<{ point: GeoPoint; toKey: string } | null>(from && to ? { point: from, toKey } : null);
  let current = origin;
  if (!from || !to) current = null;
  else if (!origin || origin.toKey !== toKey || distanceMeters(origin.point, from) > REROUTE_METERS) current = { point: from, toKey };
  if (current !== origin) setOrigin(current);

  const key = current ? `${pointKey(current.point)};${current.toKey}` : '';
  const points = useMemo<GeoPoint[] | null>(() => (current && to ? [current.point, to] : null), [key]); // eslint-disable-line react-hooks/exhaustive-deps
  const [resolved, setResolved] = useState<{ toKey: string; coords: GeoPoint[] | null } | null>(null);

  useEffect(() => {
    if (!points) return;
    let alive = true;
    fetchRoute(points).then((coords) => {
      // Yeni yol alınamazsa aynı hedefe giden önceki yol kalır (çizgi kesikliye dönüp geri gelmez).
      if (alive) setResolved((prev) => (coords || prev?.toKey !== toKey ? { toKey, coords } : prev));
    });
    return () => {
      alive = false;
    };
  }, [key, points, toKey]);

  // Yeni yol gelene kadar aynı hedefe giden önceki yol, aracın kalan kısmıyla gösterilir.
  const precise = resolved?.toKey === toKey ? resolved.coords : null;
  return useMemo(() => {
    if (!from || !to) return null;
    return precise ? { coordinates: remaining(precise, from), precise: true } : { coordinates: [from, to], precise: false };
  }, [from, to, precise]);
}
