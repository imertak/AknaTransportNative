import { ChevronDown } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { LayoutAnimation, Platform, Pressable, StyleSheet, UIManager, View } from 'react-native';

import { colors, radius, spacing } from '@/theme';
import { InfoTip } from './InfoTip';
import { Text } from './Text';

interface Props {
  title: string;
  /** Kapalıyken başlığın altında görünen kısa özet (ör. "2 kişi", "Atanmadı"). */
  summary?: string;
  /** İlk açılıştaki durum; varsayılan kapalı. */
  defaultOpen?: boolean;
  /** true iken (ör. içinde hata varsa) kart kapatılamaz ve açık görünür. */
  forceOpen?: boolean;
  /** Başlığın yanında "i" ikonuyla açılan açıklama. */
  info?: string;
  children: ReactNode;
}

// Eski mimaride Android LayoutAnimation'ı ayrıca açmak gerekir; yeni mimaride bu çağrı etkisizdir.
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) UIManager.setLayoutAnimationEnabledExperimental(true);

/** Açılış/kapanış: kısa ve sade; alttaki alanlar da birlikte kayar. */
const TOGGLE_ANIMATION = LayoutAnimation.create(200, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity);

/** Başlığına dokununca açılıp kapanan kart. Formdaki isteğe bağlı bölümler için. */
export function CollapsibleCard({ title, summary, defaultOpen = false, forceOpen, info, children }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const expanded = open || !!forceOpen;
  return (
    <View style={styles.card}>
      <Pressable
        onPress={() => {
          if (forceOpen) return;
          LayoutAnimation.configureNext(TOGGLE_ANIMATION);
          setOpen(!expanded);
        }}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`${title}${summary ? `, ${summary}` : ''}`}
        style={({ pressed }) => [styles.head, pressed && { backgroundColor: colors.surfaceMuted }]}>
        <View style={{ flex: 1, gap: 2 }}>
          <View style={styles.titleRow}>
            <Text variant="subheading">{title}</Text>
            {info ? <InfoTip text={info} label={`${title} hakkında`} size={14} /> : null}
          </View>
          {summary ? <Text variant="bodySmall" tone="secondary" numberOfLines={1}>{summary}</Text> : null}
        </View>
        <View style={expanded ? styles.chevronOpen : undefined}>
          <ChevronDown size={20} color={expanded ? colors.text : colors.textSecondary} />
        </View>
      </Pressable>
      {expanded ? <View style={styles.body}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, overflow: 'hidden' },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md + 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  chevronOpen: { transform: [{ rotate: '180deg' }] },
  body: { gap: spacing.lg, paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: spacing.lg },
});
