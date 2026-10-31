import { Tabs } from 'expo-router';
import { ClipboardList, History, House, Map, UserRound } from 'lucide-react-native';

import { tabIcon, tabScreenOptions } from '@/navigation/tabOptions';

export default function DriverTabs() {
  return (
    <Tabs screenOptions={tabScreenOptions}>
      <Tabs.Screen name="home" options={{ title: 'Ana Sayfa', tabBarIcon: tabIcon(House) }} />
      <Tabs.Screen name="jobs" options={{ title: 'İşlerim', tabBarIcon: tabIcon(ClipboardList) }} />
      <Tabs.Screen name="map" options={{ title: 'Harita', tabBarIcon: tabIcon(Map) }} />
      <Tabs.Screen name="history" options={{ title: 'Geçmiş', tabBarIcon: tabIcon(History) }} />
      <Tabs.Screen name="profile" options={{ title: 'Profil', tabBarIcon: tabIcon(UserRound) }} />
    </Tabs>
  );
}
