import { Tabs, router } from 'expo-router';
import { ClipboardList, LayoutGrid, Map, Plus, ReceiptText } from 'lucide-react-native';
import { Pressable, StyleSheet } from 'react-native';

import { routes } from '@/navigation/routes';
import { tabIcon, tabScreenOptions } from '@/navigation/tabOptions';

function CreateJobButton() {
  return (
    <Pressable
      onPress={() => router.push(routes.newJob())}
      style={({ pressed }) => [styles.fab, pressed && { opacity: 0.8, transform: [{ scale: 0.95 }] }]}
      accessibilityRole="button"
      accessibilityLabel="Yeni iş oluştur"
    >
      <Plus size={28} color="#FFFFFF" strokeWidth={2.5} />
    </Pressable>
  );
}

export default function AdminTabs() {
  return (
    <Tabs screenOptions={tabScreenOptions}>
      <Tabs.Screen name="dashboard" options={{ title: 'Panel', tabBarIcon: tabIcon(LayoutGrid) }} />
      <Tabs.Screen name="jobs" options={{ title: 'İşler', tabBarIcon: tabIcon(ClipboardList) }} />
      <Tabs.Screen
        name="create"
        options={{
          title: '',
          tabBarIcon: () => <CreateJobButton />,
          tabBarLabel: () => null,
        }}
        listeners={{ tabPress: (e) => { e.preventDefault(); router.push(routes.newJob()); } }}
      />
      <Tabs.Screen name="map" options={{ title: 'Harita', tabBarIcon: tabIcon(Map) }} />
      <Tabs.Screen name="reports" options={{ title: 'Faturalar', tabBarIcon: tabIcon(ReceiptText) }} />
      {/* Hidden tabs - accessible via routes but not shown in tab bar */}
      <Tabs.Screen name="customers" options={{ href: null }} />
      <Tabs.Screen name="profile" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  fab: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
});
