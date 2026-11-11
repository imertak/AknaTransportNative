import { router } from 'expo-router';
import { FileSpreadsheet, Plus, ReceiptText, SlidersHorizontal } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { InvoiceRow } from '@/components/invoices/InvoiceRow';
import { Button, Chip, DateField, EmptyState, ErrorState, IconButton, LoadingState, LoadMoreFooter, MonthHeader, PageHeader, Screen, SegmentedControl, SelectField, Sheet, type SelectOption } from '@/components/ui';
import { useCustomers, useDataStatus, useInvoices } from '@/hooks/useData';
import { useRefreshOnCountChange } from '@/hooks/useListSync';
import { useRefresh } from '@/hooks/useRefresh';
import { useServerList } from '@/hooks/useServerList';
import { routes } from '@/navigation/routes';
import { matchesInvoiceFilter } from '@/services/invoiceUtils';
import { invoiceService } from '@/services/registry';
import { colors, radius, spacing } from '@/theme';
import type { Invoice, InvoiceFilter } from '@/types';
import { formatCurrency, formatDate } from '@/utils/format';
import { groupByMonth, monthRowKey } from '@/utils/monthGroups';

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
  // Liste sunucudan sayfa sayfa çekilir (yeniden eskiye); başlıktaki adet ve tutarlar sunucu özetinden gelir.
  const list = useServerList({
    key: JSON.stringify(filter),
    fetchPage: (page, size) => invoiceService.listPage(filter, page, size),
    fetchSummary: () => invoiceService.summary(filter),
    getId: (i: Invoice) => i.id,
  });
  // Uygulama verisindeki güncel hâl kullanılır (iptal, silme, imza listeye hemen yansır).
  const ready = useDataStatus() === 'ready';
  const storeById = useMemo(() => new Map(invoices.map((i) => [i.id, i])), [invoices]);
  const data = useMemo(
    () => list.items.map((i) => storeById.get(i.id) ?? (ready ? undefined : i)).filter((i): i is Invoice => !!i && matchesInvoiceFilter(i, filter)),
    [list.items, storeById, ready, filter],
  );
  // Yeni fatura eklenince veya fatura silinince liste sessizce yenilenir.
  useRefreshOnCountChange(invoices.length, ready, list.refresh);
  const months = useMemo(() => new Map(list.summary?.months.map((m) => [m.month, m]) ?? []), [list.summary]);
  const rows = useMemo(() => groupByMonth(data, (i) => i.issueDate, (i) => i.id), [data]);
  const onPullRefresh = useCallback(async () => {
    await Promise.all([onRefresh(), list.refresh()]);
  }, [onRefresh, list]);
  const open = useCallback((inv: Invoice) => router.push(routes.invoice(inv.id)), []);
  const customerOptions = useMemo<SelectOption[]>(() => [{ value: ALL, label: 'Tüm müşteriler' }, ...customers.map((c) => ({ value: c.id, label: c.companyName }))], [customers]);
  const customerName = customers.find((c) => c.id === customerId)?.companyName;
  const rangeError = dateFrom && dateTo && dateFrom > dateTo ? 'Bitiş tarihi başlangıçtan önce olamaz.' : undefined;
  const activeFilters = (customerId !== ALL ? 1 : 0) + (dateFrom || dateTo ? 1 : 0);

  return (
    <Screen>
      <PageHeader
        title="Faturalarım"
        subtitle={list.summary ? `${list.summary.count} fatura · ${formatCurrency(list.summary.total, { decimals: 2 })}` : 'Yükleniyor…'}
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
      {list.loading && list.items.length === 0 ? (
        <LoadingState label="Faturalar yükleniyor" />
      ) : list.error && list.items.length === 0 ? (
        <ErrorState message={list.error} onRetry={list.retry} />
      ) : (
      <FlatList
        data={rows}
        keyExtractor={monthRowKey}
        contentContainerStyle={styles.list}
        refreshing={refreshing}
        onRefresh={onPullRefresh}
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
        renderItem={({ item: row, index }) =>
          row.kind === 'month' ? (
            <MonthHeader
              label={row.label}
              first={index === 0}
              summary={`${months.get(row.month)?.count ?? row.items.length} fatura · ${formatCurrency(
                months.get(row.month)?.total ?? row.items.filter((i) => i.status !== 'cancelled').reduce((s, i) => s + (i.payableAmount ?? i.total), 0),
              )}`}
            />
          ) : (
            <View style={[styles.item, row.first && styles.first, row.last && styles.last]}>
              <InvoiceRow invoice={row.item} onPress={open} showCustomer last={row.last} />
            </View>
          )
        }
        onEndReached={list.loadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={<LoadMoreFooter shown={list.items.length} total={list.totalCount} unit="fatura" onMore={list.loadMore} loading={list.loadingMore} />}
        ListEmptyComponent={
          <EmptyState
            icon={ReceiptText}
            title={activeFilters || status !== 'all' ? 'Filtreye uygun fatura yok' : 'Fatura yok'}
            description="İptal edilmemiş ve faturalandırılmamış işler için fatura oluşturabilirsiniz."
            action={<Button label="Fatura oluştur" size="sm" icon={Plus} onPress={() => router.push(routes.newInvoice())} />}
          />
        }
      />
      )}

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
        <View style={{ paddingHorizontal: spacing.xl, gap: spacing.lg }}>
          <SelectField label="Müşteri" options={customerOptions} value={customerId} onChange={setCustomerId} searchable />
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <View style={{ flex: 1 }}>
              <DateField label="Başlangıç" value={dateFrom ?? null} onChange={setDateFrom} hint="Tarih filtresi fatura tarihine göre uygulanır." />
            </View>
            <View style={{ flex: 1 }}>
              <DateField label="Bitiş" value={dateTo ?? null} onChange={setDateTo} error={rangeError} />
            </View>
          </View>
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
