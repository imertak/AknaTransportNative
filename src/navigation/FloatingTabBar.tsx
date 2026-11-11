import type { ComponentProps, ReactNode } from 'react';
import type { Tabs } from 'expo-router';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { useBottomInset } from '@/hooks/useBottomInset';
import { colors, radius } from '@/theme';

type BottomTabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

interface FloatingTabBarProps extends BottomTabBarProps {
  /** Adı verilen sekme yerine çizilecek öğe (ör. ortadaki "+" butonu). */
  custom?: Record<string, ReactNode>;
}

/**
 * Kenarlardan boşluklu, köşeleri hafifçe yuvarlatılmış beyaz alt menü. Seçili sekme açık gri bir
 * zemin üzerinde siyah ikon ve yazıyla gösterilir.
 */
export function FloatingTabBar({ state, descriptors, emitter, navigateToTab, custom }: FloatingTabBarProps) {
  const bottom = useBottomInset();

  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(bottom, 10) }]}>
      <View style={styles.bar} role="tablist">
        {state.routes.map((route, index) => {
          if (custom?.[route.name] !== undefined) {
            return (
              <View key={route.key} style={styles.item}>
                {custom[route.name]}
              </View>
            );
          }

          const { options } = descriptors[route.key];
          const focused = index === state.index;
          const color = focused ? colors.text : colors.textTertiary;
          const label = typeof options.title === 'string' ? options.title : route.name;

          const onPress = () => {
            const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) navigateToTab(route.key);
          };

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              onLongPress={() => emitter.emit({ type: 'tabLongPress', target: route.key })}
              android_ripple={{ color: 'transparent', borderless: true }}
              role="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
              style={styles.item}
            >
              <View style={[styles.pill, focused && styles.pillActive]}>
                {options.tabBarIcon?.({ focused, color, size: 22 })}
                <Text style={[styles.label, { color }]} numberOfLines={1}>
                  {label}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.background,
    paddingHorizontal: 12,
    paddingTop: 6,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    ...Platform.select({
      ios: { shadowColor: colors.ink, shadowOpacity: 0.08, shadowRadius: 14, shadowOffset: { width: 0, height: 4 } },
      android: { elevation: 4 },
      default: { boxShadow: '0 4px 14px rgba(0,0,0,0.08)' },
    }),
  },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  pill: {
    alignSelf: 'stretch',
    alignItems: 'center',
    gap: 3,
    paddingVertical: 8,
    marginHorizontal: 2,
    borderRadius: radius.lg,
  },
  pillActive: { backgroundColor: colors.background },
  label: { fontSize: 11, fontWeight: '600' },
});
