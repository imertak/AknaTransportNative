import { Tabs, router } from 'expo-router';
import { ClipboardList, LayoutGrid, Map, Plus, ReceiptText } from 'lucide-react-native';
import { StyleSheet } from 'react-native';

import { ScalePressable } from '@/components/ui';

import { routes } from '@/navigation/routes';
import { tabIcon, useTabScreenOptions } from '@/navigation/tabOptions';
import { colors } from '@/theme';

/** Alt menünün ortasındaki neon yeşil "yeni iş" butonu (uygulamanın ana aksiyonu). */
function CreateJobButton() {
  return (
    <ScalePressable
      onPress={() => router.push(routes.newJob())}
      pressedScale={0.94}
      style={styles.fab}
      accessibilityRole="button"
      accessibilityLabel="Yeni iş oluştur"
    >
      <Plus size={28} color={colors.onAccent} strokeWidth={2.5} />
    </ScalePressable>
  );
}

/** Müşteriler ve Profilim alt menüde yer almaz: müşterilere panelden, profile sağ üstten ulaşılır. */
export default function AdminTabs() {
  return (
    <Tabs screenOptions={useTabScreenOptions()}>
      <Tabs.Screen name="dashboard" options={{ title: 'Panel', tabBarIcon: tabIcon(LayoutGrid) }} />
      <Tabs.Screen name="jobs" options={{ title: 'İşler', tabBarIcon: tabIcon(ClipboardList) }} />
      <Tabs.Screen
        name="create"
        options={{ title: 'Yeni iş', tabBarIcon: () => <CreateJobButton />, tabBarLabel: () => null, tabBarAccessibilityLabel: 'Yeni iş oluştur' }}
        listeners={{
          tabPress: (e) => {
            e.preventDefault();
            router.push(routes.newJob());
          },
        }}
      />
      <Tabs.Screen name="map" options={{ title: 'Harita', tabBarIcon: tabIcon(Map) }} />
      <Tabs.Screen name="invoices" options={{ title: 'Faturalarım', tabBarIcon: tabIcon(ReceiptText) }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  fab: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    shadowColor: colors.ink,
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
});
