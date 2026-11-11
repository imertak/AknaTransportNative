import { Tabs } from 'expo-router';
import { ClipboardList, House, Map, ReceiptText } from 'lucide-react-native';

import { CreateMenuButton } from '@/navigation/CreateMenuButton';
import { FloatingTabBar } from '@/navigation/FloatingTabBar';
import { tabIcon, useTabScreenOptions } from '@/navigation/tabOptions';

/** Müşteriler ve Profilim alt menüde yer almaz: müşterilere ana sayfadan, profile sağ üstten ulaşılır. */
export default function AdminTabs() {
  return (
    <Tabs screenOptions={useTabScreenOptions()} tabBar={(props) => <FloatingTabBar {...props} custom={{ create: <CreateMenuButton /> }} />}>
      <Tabs.Screen name="dashboard" options={{ title: 'Ana Sayfa', tabBarIcon: tabIcon(House) }} />
      <Tabs.Screen name="jobs" options={{ title: 'İşler', tabBarIcon: tabIcon(ClipboardList) }} />
      {/* Ortadaki "+" butonu: basınca Yeni iş / Yeni fatura menüsü açılır (bkz. CreateMenuButton). */}
      <Tabs.Screen name="create" options={{ title: 'Yeni' }} />
      <Tabs.Screen name="map" options={{ title: 'Harita', tabBarIcon: tabIcon(Map) }} />
      <Tabs.Screen name="invoices" options={{ title: 'Faturalarım', tabBarIcon: tabIcon(ReceiptText) }} />
    </Tabs>
  );
}
