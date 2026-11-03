import type { StyleSpecification } from '@maplibre/maplibre-react-native';

import type { MapThemeTokens } from './tokens';

export interface MapSourceConfig {
  /** OpenMapTiles şemasında vektör karo TileJSON adresi. */
  tilesUrl: string;
  /** {fontstack} ve {range} içeren glif adresi. */
  glyphsUrl: string;
  attribution: string;
}

type Layers = StyleSpecification['layers'];
type Width = [number, number][];

/** Zoom'a göre üstel çizgi kalınlığı. */
const w = (stops: Width) => ['interpolate', ['exponential', 1.5], ['zoom'], ...stops.flat()] as unknown as number;

const roadClass = (...classes: string[]) => ['match', ['get', 'class'], classes, true, false] as unknown as boolean;

/**
 * OpenMapTiles şemasındaki vektör karolardan AKNA için sade bir MapLibre stili üretir.
 * - İlgi noktası (POI) simgeleri, ev numaraları ve ikincil detaylar gösterilmez.
 * - Yollar sınıfına göre dört kademede (otoyol, ana, tali, ara sokak) ayrışır.
 * - Binalar yalnızca yakın zoom'da ve çok açık gri olarak çizilir.
 */
export function buildMapStyle(t: MapThemeTokens, source: MapSourceConfig): StyleSpecification {
  const halo = { 'text-halo-color': t.labelHalo, 'text-halo-width': 1.4, 'text-halo-blur': 0.2 };

  const roads: Layers = [];
  // Önce tüm kenar çizgileri, sonra dolgular: kavşaklarda temiz birleşim.
  const roadDefs: { id: string; classes: string[]; fill: string; casing: string; width: Width; minzoom: number }[] = [
    { id: 'minor', classes: ['minor', 'service'], fill: t.minor, casing: t.minorCasing, width: [[13, 1], [16, 7], [20, 22]], minzoom: 13 },
    { id: 'secondary', classes: ['secondary', 'tertiary'], fill: t.secondary, casing: t.secondaryCasing, width: [[9, 0.8], [14, 5], [18, 18]], minzoom: 9 },
    { id: 'primary', classes: ['primary'], fill: t.primary, casing: t.primaryCasing, width: [[7, 0.8], [13, 5], [18, 22]], minzoom: 7 },
    { id: 'motorway', classes: ['motorway', 'trunk'], fill: t.motorway, casing: t.motorwayCasing, width: [[5, 0.8], [12, 4.5], [18, 26]], minzoom: 5 },
  ];
  for (const r of roadDefs) {
    roads.push({
      id: `road-${r.id}-casing`,
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'transportation',
      minzoom: Math.max(r.minzoom, 11),
      filter: ['all', roadClass(...r.classes), ['!=', ['get', 'brunnel'], 'tunnel']] as never,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': r.casing, 'line-width': w(r.width.map(([z, v]) => [z, v + 1.6])) },
    });
  }
  for (const r of roadDefs) {
    roads.push({
      id: `road-${r.id}`,
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'transportation',
      minzoom: r.minzoom,
      filter: roadClass(...r.classes) as never,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        // Düşük zoom'da beyaz yollar zeminde kaybolmasın diye kenar rengiyle çizilir.
        'line-color': ['step', ['zoom'], r.casing, 11, r.fill] as never,
        'line-width': w(r.width),
        'line-opacity': ['case', ['==', ['get', 'brunnel'], 'tunnel'], 0.55, 1] as never,
      },
    });
  }

  return {
    version: 8,
    name: `AKNA ${t.name}`,
    glyphs: source.glyphsUrl,
    sources: {
      openmaptiles: { type: 'vector', url: source.tilesUrl, attribution: source.attribution },
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': t.background } },
      {
        id: 'landuse-residential',
        type: 'fill',
        source: 'openmaptiles',
        'source-layer': 'landuse',
        filter: ['in', ['get', 'class'], ['literal', ['residential', 'suburb', 'neighbourhood']]] as never,
        paint: { 'fill-color': t.residential, 'fill-opacity': ['interpolate', ['linear'], ['zoom'], 9, 0.4, 13, 1] as never },
      },
      {
        id: 'landcover-green',
        type: 'fill',
        source: 'openmaptiles',
        'source-layer': 'landcover',
        filter: ['in', ['get', 'class'], ['literal', ['wood', 'grass', 'farmland']]] as never,
        paint: { 'fill-color': t.green, 'fill-opacity': 0.8 },
      },
      { id: 'park', type: 'fill', source: 'openmaptiles', 'source-layer': 'park', paint: { 'fill-color': t.green } },
      { id: 'water', type: 'fill', source: 'openmaptiles', 'source-layer': 'water', paint: { 'fill-color': t.water } },
      {
        id: 'waterway',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'waterway',
        minzoom: 10,
        paint: { 'line-color': t.water, 'line-width': w([[10, 0.6], [16, 3]]) },
      },
      {
        id: 'building',
        type: 'fill',
        source: 'openmaptiles',
        'source-layer': 'building',
        minzoom: 14,
        paint: {
          'fill-color': t.building,
          'fill-outline-color': t.buildingOutline,
          'fill-opacity': ['interpolate', ['linear'], ['zoom'], 14, 0, 15, 1] as never,
        },
      },
      {
        id: 'boundary-country',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'boundary',
        filter: ['all', ['==', ['get', 'admin_level'], 2], ['!=', ['get', 'maritime'], 1]] as never,
        paint: { 'line-color': t.boundary, 'line-width': w([[3, 0.6], [10, 1.6]]), 'line-dasharray': [3, 2] },
      },
      {
        id: 'rail',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'transportation',
        minzoom: 12,
        filter: roadClass('rail', 'transit') as never,
        paint: { 'line-color': t.rail, 'line-width': w([[12, 0.6], [18, 2]]), 'line-dasharray': [2, 2] },
      },
      ...roads,
      {
        id: 'water-name',
        type: 'symbol',
        source: 'openmaptiles',
        'source-layer': 'water_name',
        minzoom: 11,
        layout: { 'text-field': ['coalesce', ['get', 'name:tr'], ['get', 'name']] as never, 'text-font': t.fonts.italic, 'text-size': 12 },
        paint: { 'text-color': t.waterLabel, ...halo },
      },
      {
        id: 'road-name',
        type: 'symbol',
        source: 'openmaptiles',
        'source-layer': 'transportation_name',
        minzoom: 13,
        filter: roadClass('motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'minor') as never,
        layout: {
          'symbol-placement': 'line',
          'text-field': ['coalesce', ['get', 'name:tr'], ['get', 'name']] as never,
          'text-font': t.fonts.regular,
          'text-size': ['interpolate', ['linear'], ['zoom'], 13, 10, 17, 13] as never,
          'text-letter-spacing': 0.02,
          'text-max-angle': 30,
        },
        paint: { 'text-color': t.roadLabel, ...halo },
      },
      {
        id: 'place-minor',
        type: 'symbol',
        source: 'openmaptiles',
        'source-layer': 'place',
        minzoom: 11,
        filter: ['in', ['get', 'class'], ['literal', ['suburb', 'quarter', 'neighbourhood', 'village']]] as never,
        layout: {
          'text-field': ['coalesce', ['get', 'name:tr'], ['get', 'name']] as never,
          'text-font': t.fonts.regular,
          'text-size': ['interpolate', ['linear'], ['zoom'], 11, 11, 16, 14] as never,
          'text-transform': 'uppercase',
          'text-letter-spacing': 0.08,
          'text-max-width': 8,
        },
        paint: { 'text-color': t.placeMinor, ...halo },
      },
      {
        id: 'place-major',
        type: 'symbol',
        source: 'openmaptiles',
        'source-layer': 'place',
        maxzoom: 14,
        filter: ['in', ['get', 'class'], ['literal', ['city', 'town']]] as never,
        layout: {
          'text-field': ['coalesce', ['get', 'name:tr'], ['get', 'name']] as never,
          'text-font': t.fonts.bold,
          'text-size': ['interpolate', ['linear'], ['zoom'], 4, 11, 10, 16] as never,
          'text-max-width': 8,
          'symbol-sort-key': ['coalesce', ['get', 'rank'], 99] as never,
        },
        paint: { 'text-color': t.placeMajor, ...halo },
      },
    ],
  };
}
