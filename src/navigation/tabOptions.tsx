import type { ComponentProps } from 'react';
import { PlatformPressable } from 'expo-router/react-navigation';
import type { LucideIcon } from 'lucide-react-native';
import { Platform, type ColorValue } from 'react-native';

import { useBottomInset } from '@/hooks/useBottomInset';
import { colors } from '@/theme';

/**
 * Alt menü ayarları. Android'de uygulama kenardan kenara (edge-to-edge) çizilir; sistem gezinme
 * çubuğunun yüksekliği (insets.bottom) eklenmezse menü telefonun geri/ana ekran butonlarının altında kalır.
 */
export function useTabScreenOptions() {
  const bottom = useBottomInset();
  return {
    headerShown: false,
    tabBarActiveTintColor: colors.text,
    tabBarInactiveTintColor: colors.textTertiary,
    tabBarStyle: {
      backgroundColor: colors.surface,
      borderTopColor: colors.border,
      height: (Platform.OS === 'ios' ? 50 : 58) + Math.max(bottom, Platform.OS === 'ios' ? 34 : 6),
      paddingTop: 6,
      paddingBottom: Math.max(bottom, Platform.OS === 'ios' ? 34 : 6),
    },
    tabBarLabelStyle: { fontSize: 11, fontWeight: '600' as const },
    sceneStyle: { backgroundColor: colors.background },
    // Android'de sekmeye basınca çıkan gri yuvarlak dalga (ripple) efektini kapatır.
    tabBarButton: (props: ComponentProps<typeof PlatformPressable>) => (
      <PlatformPressable {...props} pressColor="transparent" android_ripple={{ color: 'transparent', borderless: true }} />
    ),
  };
}

export const tabIcon = (Icon: LucideIcon) => {
  function TabIcon({ color, focused }: { color: ColorValue; focused: boolean }) {
    return <Icon size={22} color={String(color ?? colors.text)} strokeWidth={focused ? 2.2 : 1.8} />;
  }
  return TabIcon;
};
