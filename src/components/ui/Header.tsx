import { router } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { memo, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radius, spacing } from '@/theme';
import { IconButton } from './IconButton';
import { Text } from './Text';

interface PageHeaderProps {
  title: string;
  overline?: string;
  subtitle?: string;
  right?: ReactNode;
  children?: ReactNode;
}

/** Sekme kök ekranlarının koyu başlık alanı. */
export const PageHeader = memo(function PageHeader({ title, overline, subtitle, right, children }: PageHeaderProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.page, { paddingTop: insets.top + spacing.md }]}>
      <View style={styles.row}>
        <View style={styles.titles}>
          {overline ? <Text variant="caption" tone="inverseMuted">{overline}</Text> : null}
          <Text variant="title" tone="inverse" numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? <Text variant="bodySmall" tone="inverseMuted" numberOfLines={2}>{subtitle}</Text> : null}
        </View>
        {right ? <View style={styles.right}>{right}</View> : null}
      </View>
      {children ? <View style={styles.children}>{children}</View> : null}
    </View>
  );
});

interface NavHeaderProps {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  onBack?: () => void;
  children?: ReactNode;
}

/** Detay ve form ekranlarının geri butonlu başlığı. */
export const NavHeader = memo(function NavHeader({ title, subtitle, right, onBack, children }: NavHeaderProps) {
  const insets = useSafeAreaInsets();
  const back = onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/')));
  return (
    <View style={[styles.nav, { paddingTop: insets.top + spacing.sm }]}>
      <View style={styles.row}>
        <IconButton icon={ChevronLeft} label="Geri" onPress={back} tone="dark" />
        <View style={styles.navTitles}>
          <Text variant="heading" tone="inverse" numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? <Text variant="bodySmall" tone="inverseMuted" numberOfLines={1}>{subtitle}</Text> : null}
        </View>
        {right ? <View style={styles.right}>{right}</View> : null}
      </View>
      {children ? <View style={styles.children}>{children}</View> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  page: {
    backgroundColor: colors.ink,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
  },
  nav: {
    backgroundColor: colors.ink,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  titles: { flex: 1, gap: spacing.xs },
  navTitles: { flex: 1 },
  right: { flexDirection: 'row', gap: spacing.sm },
  children: { marginTop: spacing.lg },
});
