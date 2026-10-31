import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { memo, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors, radius, spacing } from '@/theme';
import type { ISODate } from '@/types';
import { formatDate, fromISODate, MONTH_NAMES, toISODate, todayISO } from '@/utils/format';
import { Button } from './Button';
import { FieldShell } from './Field';
import { IconButton } from './IconButton';
import { Sheet } from './Sheet';
import { Text } from './Text';

const WEEK = ['Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct', 'Pz'];

interface CalendarProps {
  value?: ISODate | null;
  onSelect: (iso: ISODate) => void;
  min?: ISODate;
  max?: ISODate;
}

/** Bağımlılıksız, Pazartesi ile başlayan ay takvimi. */
export function Calendar({ value, onSelect, min, max }: CalendarProps) {
  const initial = value ? fromISODate(value) : new Date();
  const [cursor, setCursor] = useState({ y: initial.getFullYear(), m: initial.getMonth() });
  const today = todayISO();

  const cells = useMemo(() => {
    const first = new Date(cursor.y, cursor.m, 1);
    const offset = (first.getDay() + 6) % 7;
    const days = new Date(cursor.y, cursor.m + 1, 0).getDate();
    const out: (ISODate | null)[] = Array.from({ length: offset }, () => null);
    for (let d = 1; d <= days; d++) out.push(toISODate(new Date(cursor.y, cursor.m, d)));
    while (out.length % 7) out.push(null);
    return out;
  }, [cursor]);

  const shift = (delta: number) =>
    setCursor((c) => {
      const d = new Date(c.y, c.m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });

  return (
    <View style={styles.calendar}>
      <View style={styles.calHeader}>
        <IconButton icon={ChevronLeft} label="Önceki ay" onPress={() => shift(-1)} size={36} />
        <Text variant="subheading">
          {MONTH_NAMES[cursor.m]} {cursor.y}
        </Text>
        <IconButton icon={ChevronRight} label="Sonraki ay" onPress={() => shift(1)} size={36} />
      </View>
      <View style={styles.weekRow}>
        {WEEK.map((w) => (
          <Text key={w} variant="caption" tone="tertiary" style={styles.weekCell}>
            {w}
          </Text>
        ))}
      </View>
      <View style={styles.grid}>
        {cells.map((iso, i) => {
          if (!iso) return <View key={`e${i}`} style={styles.cell} />;
          const disabled = (min && iso < min) || (max && iso > max);
          const selected = iso === value;
          const isToday = iso === today;
          return (
            <Pressable
              key={iso}
              disabled={!!disabled}
              onPress={() => onSelect(iso)}
              accessibilityRole="button"
              accessibilityLabel={formatDate(iso)}
              accessibilityState={{ selected, disabled: !!disabled }}
              style={styles.cell}>
              <View style={[styles.day, isToday && styles.today, selected && styles.selected]}>
                <Text variant="label" tone={selected ? 'inverse' : disabled ? 'tertiary' : 'default'} style={disabled && { opacity: 0.4 }}>
                  {Number(iso.slice(8, 10))}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

interface DateFieldProps {
  label: string;
  value?: ISODate | null;
  onChange: (iso: ISODate) => void;
  error?: string;
  required?: boolean;
  min?: ISODate;
  max?: ISODate;
  placeholder?: string;
}

export const DateField = memo(function DateField({ label, value, onChange, error, required, min, max, placeholder = 'Tarih seçin' }: DateFieldProps) {
  const [open, setOpen] = useState(false);
  return (
    <FieldShell label={label} error={error} required={required}>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value ? formatDate(value) : placeholder}`}
        style={({ pressed }) => [styles.box, !!error && { borderColor: colors.danger }, pressed && { backgroundColor: colors.surfaceMuted }]}>
        <CalendarDays size={18} color={colors.textTertiary} />
        <Text style={{ flex: 1 }} tone={value ? 'default' : 'tertiary'}>
          {value ? formatDate(value) : placeholder}
        </Text>
      </Pressable>
      <Sheet
        visible={open}
        onClose={() => setOpen(false)}
        title={label}
        footer={
          <Button
            label="Bugün"
            variant="secondary"
            onPress={() => {
              onChange(todayISO());
              setOpen(false);
            }}
          />
        }>
        <Calendar
          value={value}
          min={min}
          max={max}
          onSelect={(iso) => {
            onChange(iso);
            setOpen(false);
          }}
        />
      </Sheet>
    </FieldShell>
  );
});

const styles = StyleSheet.create({
  box: {
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md + 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  calendar: { paddingHorizontal: spacing.lg },
  calHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  weekRow: { flexDirection: 'row', marginBottom: spacing.xs },
  weekCell: { flex: 1, textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  day: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  today: { borderWidth: 1, borderColor: colors.borderStrong },
  selected: { backgroundColor: colors.ink, borderColor: colors.ink },
});
