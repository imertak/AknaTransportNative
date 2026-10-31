import { router } from 'expo-router';
import { ChevronRight, Download, FileSpreadsheet, Printer, ReceiptText } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Button, Card, Chip, DateField, EmptyState, PageHeader, Screen, Section, SegmentedControl, SelectField, Text, type SelectOption } from '@/components/ui';
import { VEHICLE_TYPE_LABEL } from '@/constants/vehicles';
import { useAsyncAction } from '@/hooks/useAsyncAction';
import { useCustomers, useInvoices, useJobs } from '@/hooks/useData';
import { routes } from '@/navigation/routes';
import { reportService } from '@/services';
import { composeJobsReport } from '@/services/reportService';
import { colors, radius, spacing } from '@/theme';
import type { DateRange } from '@/types';
import { addDays, formatCurrency, formatDate, fromISODate, toISODate, todayISO } from '@/utils/format';

const ALL = '__all';
const PREVIEW_LIMIT = 30;

function presets(): { key: string; label: string; range: DateRange }[] {
  const today = todayISO();
  const d = fromISODate(today);
  const weekStart = addDays(today, -((d.getDay() + 6) % 7));
  const monthStart = toISODate(new Date(d.getFullYear(), d.getMonth(), 1));
  const prevMonthStart = toISODate(new Date(d.getFullYear(), d.getMonth() - 1, 1));
  const prevMonthEnd = toISODate(new Date(d.getFullYear(), d.getMonth(), 0));
  return [
    { key: 'week', label: 'Bu hafta', range: { from: weekStart, to: today } },
    { key: 'month', label: 'Bu ay', range: { from: monthStart, to: today } },
    { key: 'prev', label: 'Geçen ay', range: { from: prevMonthStart, to: prevMonthEnd } },
    { key: '30', label: 'Son 30 gün', range: { from: addDays(today, -29), to: today } },
  ];
}

export default function ReportsScreen() {
  const jobs = useJobs();
  const customers = useCustomers();
  const invoices = useInvoices();
  const presetList = useMemo(presets, []);
  const [range, setRange] = useState<DateRange>(presetList[1]!.range);
  const [customerId, setCustomerId] = useState(ALL);
  const [scope, setScope] = useState<'completed' | 'all'>('completed');
  const exportAction = useAsyncAction();
  const printAction = useAsyncAction();

  const rangeError = range.from > range.to ? 'Bitiş tarihi başlangıçtan önce olamaz.' : undefined;
  const opts = useMemo(() => ({ customerId: customerId === ALL ? undefined : customerId, onlyCompleted: scope === 'completed' }), [customerId, scope]);
  const report = useMemo(() => composeJobsReport(jobs, range, opts), [jobs, range, opts]);

  const customerOptions = useMemo<SelectOption[]>(() => [{ value: ALL, label: 'Tüm müşteriler' }, ...customers.map((c) => ({ value: c.id, label: c.companyName }))], [customers]);
  const activePreset = presetList.find((p) => p.range.from === range.from && p.range.to === range.to)?.key;
  const activeInvoices = invoices.filter((i) => i.status !== 'cancelled');

  // PDF oluşturulmadan önce veri servis katmanından tazelenir
  const fresh = () => reportService.buildJobsReport(range, opts);

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.huge }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <PageHeader title="Faturalar" subtitle="Fatura yönetimi ve nakliye dökümü" />
        <View style={styles.body}>
          <Card onPress={() => router.push(routes.invoices)} style={styles.invoiceLink}>
            <View style={styles.iconBox}>
              <ReceiptText size={20} color={colors.text} />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="subheading">Faturalar</Text>
              <Text variant="bodySmall" tone="secondary">
                {activeInvoices.length} geçerli fatura · {formatCurrency(activeInvoices.reduce((s, i) => s + i.total, 0), { decimals: 2 })}
              </Text>
            </View>
            <ChevronRight size={18} color={colors.textTertiary} />
          </Card>

          <Section title="İş dökümü">
            <Card style={{ gap: spacing.lg }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
                {presetList.map((p) => (
                  <Chip key={p.key} label={p.label} active={activePreset === p.key} onPress={() => setRange(p.range)} />
                ))}
              </ScrollView>
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <DateField label="Başlangıç" value={range.from} onChange={(from) => setRange((r) => ({ ...r, from }))} />
                </View>
                <View style={{ flex: 1 }}>
                  <DateField label="Bitiş" value={range.to} onChange={(to) => setRange((r) => ({ ...r, to }))} error={rangeError} />
                </View>
              </View>
              <SelectField label="Müşteri" options={customerOptions} value={customerId} onChange={setCustomerId} searchable />
              <SegmentedControl
                value={scope}
                onChange={setScope}
                options={[
                  { value: 'completed', label: 'Tamamlanan işler' },
                  { value: 'all', label: 'Tüm işler' },
                ]}
              />
            </Card>
          </Section>

          <Card tone="ink" style={styles.summary}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="bodySmall" tone="inverseMuted">
                {formatDate(range.from)} – {formatDate(range.to)}
              </Text>
              <Text variant="title" tone="inverse" style={{ fontVariant: ['tabular-nums'] }}>{formatCurrency(report.totalAmount)}</Text>
              <Text variant="bodySmall" tone="inverseMuted">{report.totalCount} iş</Text>
            </View>
            <FileSpreadsheet size={28} color={colors.textInverseMuted} strokeWidth={1.5} />
          </Card>

          <View style={styles.row}>
            <Button
              label="PDF indir"
              icon={Download}
              style={{ flex: 1 }}
              disabled={!!rangeError || report.totalCount === 0}
              loading={exportAction.pending}
              onPress={() => exportAction.run(async () => reportService.shareJobsReport(await fresh()), { error: 'PDF oluşturulamadı.' })}
            />
            <Button
              label="Yazdır"
              icon={Printer}
              variant="secondary"
              style={{ flex: 1 }}
              disabled={!!rangeError || report.totalCount === 0}
              loading={printAction.pending}
              onPress={() => printAction.run(async () => reportService.printJobsReport(await fresh()), { error: 'Yazdırma başlatılamadı.' })}
            />
          </View>

          <Section title="Önizleme">
            {report.totalCount === 0 ? (
              <EmptyState compact icon={FileSpreadsheet} title="Bu aralıkta iş yok" description="Tarih aralığını veya filtreleri değiştirin." />
            ) : (
              <Card padded={false}>
                <View style={[styles.tr, styles.th]}>
                  <Text variant="caption" tone="inverse" style={styles.cDate}>Tarih</Text>
                  <Text variant="caption" tone="inverse" style={styles.cMain}>Firma / Nakliye</Text>
                  <Text variant="caption" tone="inverse" style={styles.cPrice}>Fiyat</Text>
                </View>
                {report.jobs.slice(0, PREVIEW_LIMIT).map((j, i) => (
                  <View key={j.id} style={[styles.tr, i % 2 === 1 && styles.zebra]}>
                    <Text variant="bodySmall" style={styles.cDate}>{formatDate(j.date).slice(0, 5)}</Text>
                    <View style={styles.cMain}>
                      <Text variant="label" numberOfLines={1}>
                        {j.storeName} · {VEHICLE_TYPE_LABEL[j.vehicleType]}
                      </Text>
                      <Text variant="bodySmall" tone="secondary" numberOfLines={2}>{j.description}</Text>
                    </View>
                    <Text variant="label" style={styles.cPrice}>{formatCurrency(j.price)}</Text>
                  </View>
                ))}
                {report.totalCount > PREVIEW_LIMIT ? (
                  <Text variant="bodySmall" tone="tertiary" align="center" style={{ padding: spacing.md }}>
                    +{report.totalCount - PREVIEW_LIMIT} iş daha PDF'te yer alacak
                  </Text>
                ) : null}
                <View style={styles.total}>
                  <Text variant="subheading">Toplam · {report.totalCount} iş</Text>
                  <Text variant="subheading" style={{ fontVariant: ['tabular-nums'] }}>{formatCurrency(report.totalAmount)}</Text>
                </View>
              </Card>
            )}
          </Section>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { padding: spacing.lg, gap: spacing.xl },
  row: { flexDirection: 'row', gap: spacing.sm },
  invoiceLink: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  iconBox: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  summary: { flexDirection: 'row', alignItems: 'center' },
  tr: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2, gap: spacing.sm },
  th: { backgroundColor: colors.ink, borderTopLeftRadius: radius.lg - 1, borderTopRightRadius: radius.lg - 1, alignItems: 'center' },
  zebra: { backgroundColor: colors.surfaceMuted },
  cDate: { width: 44 },
  cMain: { flex: 1, gap: 2 },
  cPrice: { width: 84, textAlign: 'right', fontVariant: ['tabular-nums'] },
  total: { flexDirection: 'row', justifyContent: 'space-between', padding: spacing.md, borderTopWidth: 1, borderTopColor: colors.ink },
});
