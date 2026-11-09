import { GeoJSONSource, Layer } from '@maplibre/maplibre-react-native';
import { memo, useMemo } from 'react';

import { colors } from '@/theme';
import type { MapRoute } from './types';

/**
 * - `job`: iş güzergâhı (duraklar arası), beyaz kenarlı siyah çizgi.
 * - `muted`: aracın kalan yolu çizildiğinde iş güzergâhı geri planda gri kalır.
 * - `leg`: araçtan gidilen durağa kalan yol, kalın siyah çizgi.
 */
export type RouteTone = 'job' | 'muted' | 'leg';

const WIDTH: Record<RouteTone, { casing: [number, number]; line: [number, number] }> = {
  job: { casing: [5, 10], line: [2.5, 5] },
  muted: { casing: [4, 8], line: [2, 4] },
  leg: { casing: [7, 13], line: [3.5, 7] },
};

/** Güzergâh çizgisi. Yol geometrisi yoksa noktalar kesikli çizgiyle birleştirilir. */
export const RouteLayer = memo(function RouteLayer({ route, id = 'akna-route', tone = 'job' }: { route: MapRoute; id?: string; tone?: RouteTone }) {
  const data = useMemo<GeoJSON.Feature<GeoJSON.LineString>>(
    () => ({
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates: route.coordinates.map((p) => [p.longitude, p.latitude]) },
    }),
    [route.coordinates],
  );
  const width = WIDTH[tone];
  return (
    <GeoJSONSource id={id} data={data}>
      <Layer
        id={`${id}-casing`}
        type="line"
        layout={{ 'line-cap': 'round', 'line-join': 'round' }}
        paint={{ 'line-color': colors.surface, 'line-width': ['interpolate', ['linear'], ['zoom'], 8, width.casing[0], 16, width.casing[1]], 'line-opacity': 0.95 }}
      />
      <Layer
        // Kesikli/düz geçişinde katman yeniden oluşturulur (boyama özelliği kaldırılamaz).
        key={`${tone}-${route.precise ? 'precise' : 'approx'}`}
        id={`${id}-line-${tone}-${route.precise ? 'precise' : 'approx'}`}
        type="line"
        layout={{ 'line-cap': 'round', 'line-join': 'round' }}
        paint={{
          'line-color': tone === 'muted' ? colors.textTertiary : colors.ink,
          'line-width': ['interpolate', ['linear'], ['zoom'], 8, width.line[0], 16, width.line[1]],
          ...(route.precise ? null : { 'line-dasharray': [1.5, 1.5] }),
        }}
      />
    </GeoJSONSource>
  );
});
