import { GeoJSONSource, Layer } from '@maplibre/maplibre-react-native';
import { memo, useMemo } from 'react';

import { colors } from '@/theme';
import type { MapRoute } from './types';

/** İş güzergâhı: beyaz kenarlı siyah çizgi. Yol geometrisi yoksa duraklar kesikli çizgiyle birleştirilir. */
export const RouteLayer = memo(function RouteLayer({ route }: { route: MapRoute }) {
  const data = useMemo<GeoJSON.Feature<GeoJSON.LineString>>(
    () => ({
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates: route.coordinates.map((p) => [p.longitude, p.latitude]) },
    }),
    [route.coordinates],
  );
  return (
    <GeoJSONSource id="akna-route" data={data}>
      <Layer
        id="akna-route-casing"
        type="line"
        layout={{ 'line-cap': 'round', 'line-join': 'round' }}
        paint={{ 'line-color': colors.surface, 'line-width': ['interpolate', ['linear'], ['zoom'], 8, 5, 16, 10], 'line-opacity': 0.95 }}
      />
      <Layer
        // Kesikli/düz geçişinde katman yeniden oluşturulur (boyama özelliği kaldırılamaz).
        key={route.precise ? 'precise' : 'approx'}
        id={route.precise ? 'akna-route-line' : 'akna-route-line-approx'}
        type="line"
        layout={{ 'line-cap': 'round', 'line-join': 'round' }}
        paint={{
          'line-color': colors.ink,
          'line-width': ['interpolate', ['linear'], ['zoom'], 8, 2.5, 16, 5],
          ...(route.precise ? null : { 'line-dasharray': [1.5, 1.5] }),
        }}
      />
    </GeoJSONSource>
  );
});
