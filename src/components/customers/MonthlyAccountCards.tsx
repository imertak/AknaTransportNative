import { memo, useCallback, useState } from 'react';
import { type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent, ScrollView, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import type { BalanceMonth, LedgerEntry } from '@/services/accounts';
import { colors, radius, spacing } from '@/theme';
import { formatCurrency } from '@/utils/format';
import { monthLabel } from '@/utils/monthGroups';

const GAP = spacing.sm;
/** Sonraki ayın kartından görünen pay: kartların kaydırılabildiği anlaşılsın. */
const PEEK = spacing.xl;

const monthKey = (m: { year: number; month: number }) => `${m.year}-${String(m.month).padStart(2, '0')}`;

function currentMonthKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Ekstre satırlarından ay ay kesilen fatura / borç / gelen / giden (yeniden eskiye). */
export function monthsFromLedger(entries: readonly LedgerEntry[]): BalanceMonth[] {
  const map = new Map<string, BalanceMonth>();
  for (const e of entries) {
    const [y, m] = e.date.slice(0, 7).split('-').map(Number);
    if (!y || !m) continue;
    const key = `${y}-${m}`;
    let row = map.get(key);
    if (!row) map.set(key, (row = { year: y, month: m, invoiced: 0, invoiceCount: 0, charged: 0, collected: 0, refunded: 0 }));
    if (e.kind === 'Invoice') {
      row.invoiced += e.debit;
      row.invoiceCount++;
    } else if (e.kind === 'Charge') row.charged += e.debit;
    else if (e.kind === 'Collection') row.collected += e.credit;
    else if (e.kind === 'Refund') row.refunded += e.debit;
  }
  return [...map.values()].sort((a, b) => b.year - a.year || b.month - a.month);
}

/**
 * Kesilen fatura / gelen / giden kartları ay ay, yatay kaydırılır (en yeni ay solda). Toplam (tüm dönemler)
 * bakiye bu bileşenin dışında gösterilir.
 */
export const MonthlyAccountCards = memo(function MonthlyAccountCards({ months }: { months: readonly BalanceMonth[] }) {
  const [width, setWidth] = useState(0);
  const [page, setPage] = useState(0);
  const onLayout = useCallback((e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width), []);

  const single = months.length <= 1;
  const cardWidth = single ? width : Math.max(width - PEEK, 0);
  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (!cardWidth) return;
      setPage(Math.round(e.nativeEvent.contentOffset.x / (cardWidth + GAP)));
    },
    [cardWidth],
  );

  if (months.length === 0) {
    return (
      <View style={styles.empty}>
        <Text variant="bodySmall" tone="tertiary">Henüz kesilen fatura veya ödeme yok.</Text>
      </View>
    );
  }

  const now = currentMonthKey();
  return (
    <View onLayout={onLayout} style={{ gap: spacing.xs }}>
      {width > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={cardWidth + GAP}
          snapToAlignment="start"
          decelerationRate="fast"
          disableIntervalMomentum
          scrollEnabled={!single}
          onScroll={onScroll}
          scrollEventThrottle={32}
          contentContainerStyle={{ gap: GAP }}
          accessibilityLabel="Aylık hareketler, yana kaydırarak önceki aylara geçin">
          {months.map((m) => {
            const key = monthKey(m);
            return (
              <View key={key} style={[styles.card, { width: cardWidth }]}>
                <View style={styles.cardHeader}>
                  <Text variant="subheading">{monthLabel(key)}</Text>
                  {key === now ? <Text variant="caption" tone="tertiary">Bu ay</Text> : null}
                </View>
                <AmountRow
                  label="Kesilen fatura"
                  detail={`${m.invoiceCount} fatura${m.charged ? ' + borç kaydı' : ''}`}
                  value={m.invoiced + m.charged}
                />
                <AmountRow label="Gelen" detail="Tahsilat" value={m.collected} />
                <AmountRow label="Giden" detail="İade / ödeme" value={m.refunded} last />
              </View>
            );
          })}
        </ScrollView>
      ) : null}
      {!single ? (
        <View style={styles.dots} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {months.length <= 12 ? (
            months.map((m, i) => <View key={monthKey(m)} style={[styles.dot, i === page && styles.dotActive]} />)
          ) : (
            <Text variant="caption" tone="tertiary">{`${Math.min(page + 1, months.length)} / ${months.length} ay`}</Text>
          )}
        </View>
      ) : null}
    </View>
  );
});

function AmountRow({ label, detail, value, last }: { label: string; detail: string; value: number; last?: boolean }) {
  return (
    <View style={[styles.amountRow, !last && styles.amountBorder]} accessible accessibilityLabel={`${label}: ${formatCurrency(value, { decimals: 2 })}`}>
      <View style={{ flex: 1 }}>
        <Text variant="label">{label}</Text>
        <Text variant="caption" tone="tertiary">{detail}</Text>
      </View>
      <Text variant="subheading" tone={value ? 'default' : 'tertiary'} style={styles.amount} numberOfLines={1}>
        {formatCurrency(value, { decimals: 2 })}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  cardHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingBottom: spacing.xs },
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm + 2 },
  amountBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderStrong },
  amount: { fontVariant: ['tabular-nums'] },
  dots: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, minHeight: 10 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.borderStrong },
  dotActive: { width: 16, backgroundColor: colors.ink },
  empty: { padding: spacing.md, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center' },
});
