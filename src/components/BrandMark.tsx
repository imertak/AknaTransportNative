import { memo } from 'react';
import { View } from 'react-native';
import Svg, { Polygon } from 'react-native-svg';

import { colors } from '@/theme';

/** AKNA logosunun çokgenleri (436×102). API'deki PDF logosu (PdfBrand) ve uygulama ikonuyla aynı çizim. */
const POLYGONS = [
  '60,0 120.5,102 0,102',
  '121,6 213.5,6 179,55 213.5,102 121,102',
  '219,4.5 267,40 267,6 314.5,6 314.5,102 219,102',
  '376,0 436,102 316,102',
];

/** AKNA logosu (vektör). */
export const BrandMark = memo(function BrandMark({ size = 'lg', tone = 'inverse' }: { size?: 'md' | 'lg'; tone?: 'inverse' | 'default' }) {
  const width = size === 'lg' ? 200 : 140;
  const fill = tone === 'inverse' ? colors.textInverse : colors.text;
  return (
    <View accessible accessibilityRole="header" accessibilityLabel="AKNA">
      <Svg width={width} height={(width * 102) / 436} viewBox="0 0 436 102">
        {POLYGONS.map((points) => (
          <Polygon key={points} points={points} fill={fill} />
        ))}
      </Svg>
    </View>
  );
});
