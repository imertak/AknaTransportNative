import { Stack } from 'expo-router';
import * as ExpoSplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { LocationProvider } from '@/contexts/LocationContext';
import { ToastProvider } from '@/contexts/ToastContext';
import SplashScreen from '@/screens/auth/SplashScreen';
import { colors } from '@/theme';

ExpoSplashScreen.preventAutoHideAsync().catch(() => {});

/**
 * Merkezi rol yönlendirmesi: hangi rota grubunun erişilebilir olduğu
 * oturum durumu ve görünüm moduna (admin/şoför) göre burada belirlenir.
 */
function RootNavigator() {
  const { status, viewMode } = useAuth();

  useEffect(() => {
    // Yerel splash, marka splash ekranı çizildikten hemen sonra kapanır.
    ExpoSplashScreen.hideAsync().catch(() => {});
  }, []);

  if (status === 'restoring') return <SplashScreen />;

  const signedIn = status === 'signedIn';
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background }, animation: 'slide_from_right' }}>
      <Stack.Screen name="index" options={{ animation: 'none' }} />
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="login" />
        <Stack.Screen name="forgot-password" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && viewMode === 'admin'}>
        <Stack.Screen name="admin" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && viewMode === 'driver'}>
        <Stack.Screen name="driver" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider style={{ backgroundColor: colors.ink }}>
      <StatusBar style="light" />
      <ToastProvider>
        <AuthProvider>
          <LocationProvider>
            <RootNavigator />
          </LocationProvider>
        </AuthProvider>
      </ToastProvider>
    </SafeAreaProvider>
  );
}
