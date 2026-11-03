// Arka plan konum görevi modül yüklenirken tanımlanmalıdır (uygulama arka planda başlatılsa da).
import '@/services/tracking';
import { Stack } from 'expo-router';
import * as ExpoSplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { LocationProvider } from '@/contexts/LocationContext';
import { NotificationProvider } from '@/contexts/NotificationContext';
import { ToastProvider } from '@/contexts/ToastContext';
import SplashScreen from '@/screens/auth/SplashScreen';
import { RESERVES_NAV_BAR } from '@/hooks/useBottomInset';
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
      <Stack.Protected guard={status === 'signedOut'}>
        <Stack.Screen name="login" />
        <Stack.Screen name="forgot-password" />
      </Stack.Protected>
      <Stack.Protected guard={status === 'passwordChange'}>
        <Stack.Screen name="change-password" />
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

/**
 * Android 15+ uygulamayı kenardan kenara çizer ve sistem gezinme çubuğu saydam olur; ekran içeriği
 * butonların arkasında görünür. Bu çubuğun alanı opak bir şeritle ayrılır, içerik onun üstünde biter.
 */
function NavBarArea({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const { status } = useAuth();
  if (!RESERVES_NAV_BAR) return <>{children}</>;
  const dark = status !== 'signedIn';
  return <View style={{ flex: 1, paddingBottom: insets.bottom, backgroundColor: dark ? colors.ink : colors.surface }}>{children}</View>;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider style={{ backgroundColor: colors.ink }}>
      <StatusBar style="light" />
      <ToastProvider>
        <AuthProvider>
          <LocationProvider>
            <NotificationProvider>
              <NavBarArea>
                <RootNavigator />
              </NavBarArea>
            </NotificationProvider>
          </LocationProvider>
        </AuthProvider>
      </ToastProvider>
    </SafeAreaProvider>
  );
}
