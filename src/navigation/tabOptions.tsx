import type { LucideIcon } from 'lucide-react-native';
import { Platform, type ColorValue } from 'react-native';

import { colors } from '@/theme';

export const tabScreenOptions = {
  headerShown: false,
  tabBarActiveTintColor: colors.text,
  tabBarInactiveTintColor: colors.textTertiary,
  tabBarStyle: {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    height: Platform.select({ ios: 84, default: 64 }),
    paddingTop: 6,
  },
  tabBarLabelStyle: { fontSize: 11, fontWeight: '600' as const, marginBottom: Platform.OS === 'android' ? 6 : 0 },
  sceneStyle: { backgroundColor: colors.background },
};

export const tabIcon =
  (Icon: LucideIcon) =>
  ({ color, focused }: { color: ColorValue; focused: boolean }) => <Icon size={22} color={String(color ?? colors.text)} strokeWidth={focused ? 2.2 : 1.8} />;
