import { useEffect, useMemo, useState } from 'react';

import type { MapRoute, MapStop } from '@/components/map/types';
import { cachedRoute, fetchRoute } from '@/services/routing';
import type { GeoPoint } from '@/types';

/**
 * Durakları birleştiren güzergâh. Önce düz bağlantı gösterilir, yol geometrisi gelince onunla değişir.
 * Araç konumu güzergâha katılmaz: her konum güncellemesinde rota servisine istek atılmaz.
 */
export function useJobRoute(stops: MapStop[]): MapRoute | null {
  const key = stops.map((s) => `${s.coordinate.latitude},${s.coordinate.longitude}`).join('|');
  const points = useMemo<GeoPoint[]>(() => stops.map((s) => s.coordinate), [key]); // eslint-disable-line react-hooks/exhaustive-deps
  const [resolved, setResolved] = useState<{ key: string; coords: GeoPoint[] | null } | null>(() => {
    const hit = cachedRoute(points);
    return hit !== undefined ? { key, coords: hit } : null;
  });

  useEffect(() => {
    if (points.length < 2) return;
    let alive = true;
    fetchRoute(points).then((coords) => {
      if (alive) setResolved({ key, coords });
    });
    return () => {
      alive = false;
    };
  }, [key, points]);

  return useMemo(() => {
    if (points.length < 2) return null;
    const precise = resolved?.key === key ? resolved.coords : null;
    return precise ? { coordinates: precise, precise: true } : { coordinates: points, precise: false };
  }, [points, resolved, key]);
}
