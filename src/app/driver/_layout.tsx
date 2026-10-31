import { Stack } from 'expo-router';

import { colors } from '@/theme';

export const unstable_settings = { anchor: '(tabs)' };

export default function DriverLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />;
}
