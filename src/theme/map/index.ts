import { MAP_CONFIG } from '@/constants/config';
import { buildMapStyle } from './buildMapStyle';
import { aknaLightMapTheme, type MapThemeTokens } from './tokens';

export { buildMapStyle, type MapSourceConfig } from './buildMapStyle';
export { aknaLightMapTheme, type MapThemeTokens } from './tokens';

/** Uygulamanın kullandığı harita teması. Tema değiştirmek için yalnızca bu satır değiştirilir. */
export const activeMapTheme: MapThemeTokens = aknaLightMapTheme;

/** Merkezi MapLibre stili (bir kez üretilir; tüm haritalar aynı nesneyi kullanır). */
export const mapStyle = buildMapStyle(activeMapTheme, {
  tilesUrl: MAP_CONFIG.tilesUrl,
  glyphsUrl: MAP_CONFIG.glyphsUrl,
  attribution: MAP_CONFIG.attribution,
});
