import type { LucideIcon } from 'lucide-react-native';
import type { ColorValue } from 'react-native';

import { colors } from '@/theme';

/**
 * Alt menü ekran ayarları. Menünün kendisi FloatingTabBar ile çizilir; Android'deki sistem gezinme
 * çubuğu ve iOS'taki ana ekran çizgisi için alt boşluğu o bileşen ekler.
 */
export function useTabScreenOptions() {
  return {
    headerShown: false,
    sceneStyle: { backgroundColor: colors.background },
  };
}

export const tabIcon = (Icon: LucideIcon) => {
  function TabIcon({ color, focused }: { color: ColorValue; focused: boolean }) {
    return <Icon size={22} color={String(color ?? colors.text)} strokeWidth={focused ? 2.2 : 1.8} />;
  }
  return TabIcon;
};
