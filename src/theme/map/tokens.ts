/**
 * Harita teması renk ve yazı belirteçleri. Haritanın tüm görünümü bu nesneden üretilir
 * (bkz. buildMapStyle). Yeni tema için yalnızca yeni bir MapThemeTokens nesnesi yazmak yeterlidir.
 */
export interface MapThemeTokens {
  name: string;
  background: string;
  /** Park, orman, çim: yumuşak yeşil. */
  green: string;
  residential: string;
  water: string;
  waterLabel: string;
  building: string;
  buildingOutline: string;
  /** Otoyol ve ana arter dolgusu. Lojistik uygulamasında en belirgin yol sınıfıdır. */
  motorway: string;
  motorwayCasing: string;
  primary: string;
  primaryCasing: string;
  secondary: string;
  secondaryCasing: string;
  minor: string;
  minorCasing: string;
  rail: string;
  boundary: string;
  roadLabel: string;
  placeMajor: string;
  placeMinor: string;
  labelHalo: string;
  fonts: { regular: string[]; bold: string[]; italic: string[] };
}

/** AKNA açık tema: beyaz / çok açık gri zemin, gri tonlu yollar, siyah yazılar. Renkli POI yok. */
export const aknaLightMapTheme: MapThemeTokens = {
  name: 'akna-light',
  background: '#F6F6F6',
  green: '#CFE6C3',
  residential: '#F1F1F1',
  water: '#A9D3EE',
  waterLabel: '#3F7AA6',
  building: '#EAEAEA',
  buildingOutline: '#DEDEDE',
  motorway: '#C3C6CA',
  motorwayCasing: '#ADB1B6',
  primary: '#FFFFFF',
  primaryCasing: '#CFCFCF',
  secondary: '#FFFFFF',
  secondaryCasing: '#DCDCDC',
  minor: '#FFFFFF',
  minorCasing: '#E6E6E6',
  rail: '#D5D5D5',
  boundary: '#B8B8B8',
  roadLabel: '#5C5C5C',
  placeMajor: '#111111',
  placeMinor: '#6A6A6A',
  labelHalo: '#FFFFFF',
  fonts: { regular: ['Noto Sans Regular'], bold: ['Noto Sans Bold'], italic: ['Noto Sans Italic'] },
};
