import { Tabs } from 'expo-router';
import { ClipboardList, History, House, Map } from 'lucide-react-native';

import { tabIcon, tabScreenOptions } from '@/navigation/tabOptions';

/** Profil alt menüde yer almaz; ana sayfanın sağ üstündeki profil ikonundan açılır. */
export default function DriverTabs() {
  return (
    <Tabs screenOptions={tabScreenOptions}>
      <Tabs.Screen name="home" options={{ title: 'Ana Sayfa', tabBarIcon: tabIcon(House) }} />
      <Tabs.Screen name="jobs" options={{ title: 'İşlerim', tabBarIcon: tabIcon(ClipboardList) }} />
      <Tabs.Screen name="map" options={{ title: 'Harita', tabBarIcon: tabIcon(Map) }} />
      <Tabs.Screen name="history" options={{ title: 'Geçmiş', tabBarIcon: tabIcon(History) }} />
    </Tabs>
  );
}
