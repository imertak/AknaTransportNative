import { router } from 'expo-router';
import { FileSpreadsheet, Plus, ReceiptText, SlidersHorizontal } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { InvoiceRow } from '@/components/invoices/InvoiceRow';
import { Button, Chip, DateField, EmptyState, IconButton, PageHeader, Screen, SegmentedControl, SelectField, Sheet, Text, type SelectOption } from '@/components/ui';
import { useCustomers, useInvoices } from '@/hooks/useData';
import { useRefresh } from '@/hooks/useRefresh';
import { routes } from '@/navigation/routes';
import { matchesInvoiceFilter } from '@/services/invoiceUtils';
import { colors, radius, spacing } from '@/theme';
import type { Invoice, InvoiceFilter } from '@/types';
import { formatCurrency, formatDate } from '@/utils/format';

type StatusTab = 'all' | NonNullable<InvoiceFilter['status']>;
const ALL = '__all';

/** Faturalarım: fatura listesi, müşteri/tarih/durum filtreleri, yeni fatura ve iş dökümü. */
export default function InvoicesScreen() {
  const invoices = useInvoices();
  const customers = useCustomers();
  const { refreshing, onRefresh } = useRefresh();
  const [status, setStatus] = useState<StatusTab>('all');
  const [customerId, setCustomerId] = useState(ALL);
  const [dateFrom, setDateFrom] = useState<string | undefined>();
  const [dateTo, setDateTo] = useState<string | undefined>();
  const [filtersOpen, setFiltersOpen] = useState(false);

  const filter = useMemo<InvoiceFilter>(
    () => ({ status: status === 'all' ? undefined : status, customerId: customerId === ALL ? undefined : customerId, dateFrom, dateTo }),
    [status, customerId, dateFrom, dateTo],
  );
  const data = useMemo(() => invoices.filter((i) => matchesInvoiceFilter(i, filter)), [invoices, filter]);
  const total = useMemo(() => data.filter((i) => i.status !== 'cancelled').reduce((s, i) => s + i.total, 0), [data]);
  const open = useCallback((inv: Invoice) => router.push(routes.invoice(inv.id)), []);
  const customerOptions = useMemo<SelectOption[]>(() => [{ value: ALL, label: 'Tüm müşteriler' }, ...customers.map((c) => ({ value: c.id, label: c.companyName }))], [customers]);
  const customerName = customers.find((c) => c.id === customerId)?.companyName;
  const rangeError = dateFrom && dateTo && dateFrom > dateTo ? 'Bitiş tarihi başlangıçtan önce olamaz.' : undefined;
  const activeFilters = (customerId !== ALL ? 1 : 0) + (dateFrom || dateTo ? 1 : 0);

  return (
    <Screen>
      <PageHeader
        title="Faturalarım"
        subtitle={`${data.length} fatura · ${formatCurrency(total, { decimals: 2 })}`}
        right={
          <>
            <IconButton icon={SlidersHorizontal} label="Filtreler" tone="dark" onPress={() => setFiltersOpen(true)} />
            <IconButton icon={Plus} label="Fatura oluştur" tone="dark" onPress={() => router.push(routes.newInvoice())} />
          </>
        }>
        <SegmentedControl
          dark
          value={status}
          onChange={setStatus}
          options={[
            { value: 'all', label: 'Tümü' },
            { value: 'draft', label: 'Taslak' },
            { value: 'issued', label: 'Kesildi' },
            { value: 'cancelled', label: 'İptal' },
          ]}
        />
      </PageHeader>
      <FlatList
        data={data}
        keyExtractor={(i) => i.id}
        contentContainerStyle={styles.list}
        refreshing={refreshing}
        onRefresh={onRefresh}
        ListHeaderComponent={
          <View style={{ gap: spacing.md, marginBottom: spacing.md }}>
            {activeFilters ? (
              <View style={styles.chips}>
                {customerName ? <Chip label={customerName} active onClear={() => setCustomerId(ALL)} /> : null}
                {dateFrom || dateTo ? (
                  <Chip
                    label={`${dateFrom ? formatDate(dateFrom) : '…'} – ${dateTo ? formatDate(dateTo) : '…'}`}
                    active
                    onClear={() => {
                      setDateFrom(undefined);
                      setDateTo(undefined);
                    }}
                  />
                ) : null}
              </View>
            ) : null}
            <Button label="İş dökümü (tarih aralığı PDF)" icon={FileSpreadsheet} variant="secondary" size="sm" onPress={() => router.push(routes.jobReport)} />
          </View>
        }
        renderItem={({ item, index }) => (
          <View style={[styles.item, index === 0 && styles.first, index === data.length - 1 && styles.last]}>
            <InvoiceRow invoice={item} onPress={open} showCustomer last={index === data.length - 1} />
          </View>
        )}
        ListEmptyComponent={
          <EmptyState
            icon={ReceiptText}
            title={activeFilters || status !== 'all' ? 'Filtreye uygun fatura yok' : 'Fatura yok'}
            description="Tamamlanan ve faturalandırılmamış işler için fatura oluşturabilirsiniz."
            action={<Button label="Fatura oluştur" size="sm" icon={Plus} onPress={() => router.push(routes.newInvoice())} />}
          />
        }
      />

      <Sheet
        visible={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title="Filtreler"
        footer={
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Button
              label="Temizle"
              variant="secondary"
              style={{ flex: 1 }}
              onPress={() => {
                setCustomerId(ALL);
                setDateFrom(undefined);
                setDateTo(undefined);
              }}
            />
            <Button label="Uygula" style={{ flex: 2 }} disabled={!!rangeError} onPress={() => setFiltersOpen(false)} />
          </View>
        }>
        <View style={{ gap: spacing.lg }}>
          <SelectField label="Müşteri" options={customerOptions} value={customerId} onChange={setCustomerId} searchable />
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <View style={{ flex: 1 }}>
              <DateField label="Başlangıç" value={dateFrom ?? null} onChange={setDateFrom} />
            </View>
            <View style={{ flex: 1 }}>
              <DateField label="Bitiş" value={dateTo ?? null} onChange={setDateTo} error={rangeError} />
            </View>
          </View>
          <Text variant="bodySmall" tone="tertiary">Tarih filtresi fatura tarihine göre uygulanır.</Text>
        </View>
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.lg, paddingBottom: spacing.huge, flexGrow: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  item: { backgroundColor: colors.surface, borderLeftWidth: 1, borderRightWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  first: { borderTopWidth: 1, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg },
  last: { borderBottomWidth: 1, borderBottomLeftRadius: radius.lg, borderBottomRightRadius: radius.lg },
});
