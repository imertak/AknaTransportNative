import { Redirect } from 'expo-router';

import { useAuth } from '@/contexts/AuthContext';
import { routes } from '@/navigation/routes';

/** Giriş noktası: oturum ve görünüm moduna göre doğru ana ekrana yönlendirir. */
export default function Index() {
  const { status, viewMode } = useAuth();
  if (status === 'passwordChange') return <Redirect href={routes.changePassword} />;
  if (status !== 'signedIn') return <Redirect href={routes.login} />;
  return <Redirect href={routes.home(viewMode)} />;
}
