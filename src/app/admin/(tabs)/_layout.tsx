import { Tabs } from 'expo-router';
import { Building2, ClipboardList, FileText, LayoutGrid, Map, UserRound } from 'lucide-react-native';

import { tabIcon, tabScreenOptions } from '@/navigation/tabOptions';

export default function AdminTabs() {
  return (
    <Tabs screenOptions={tabScreenOptions}>
      <Tabs.Screen name="dashboard" options={{ title: 'Panel', tabBarIcon: tabIcon(LayoutGrid) }} />
      <Tabs.Screen name="jobs" options={{ title: 'İşler', tabBarIcon: tabIcon(ClipboardList) }} />
      <Tabs.Screen name="customers" options={{ title: 'Müşteriler', tabBarIcon: tabIcon(Building2) }} />
      <Tabs.Screen name="map" options={{ title: 'Harita', tabBarIcon: tabIcon(Map) }} />
      <Tabs.Screen name="reports" options={{ title: 'Raporlar', tabBarIcon: tabIcon(FileText) }} />
      <Tabs.Screen name="profile" options={{ title: 'Profil', tabBarIcon: tabIcon(UserRound) }} />
    </Tabs>
  );
}
