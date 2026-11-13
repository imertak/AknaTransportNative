import { router, useFocusEffect } from 'expo-router';
import { FileSignature, Plus, SlidersHorizontal } from 'lucide-react-native';
import { useCallback, useMemo, useRef, useState } from 'react';
import { FlatList, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { OfferRow } from '@/components/offers/OfferRow';
import { OFFER_STATUS_LABEL } from '@/components/offers/OfferStatusBadge';
import { Button, Chip, DateField, EmptyState, ErrorState, IconButton, LoadingState, LoadMoreFooter, NavHeader, Screen, SearchBar, SelectField, Sheet, StatTile, type SelectOption } from '@/components/ui';
import { useCustomers, useRemote } from '@/hooks/useData';
import { useDebounced } from '@/hooks/useDebounced';
import { useServerList } from '@/hooks/useServerList';
import { routes } from '@/navigation/routes';
import { offerService } from '@/services/offerService';
import { colors, radius, spacing } from '@/theme';
import type { OfferFilter, OfferListItem, OfferStatus } from '@/types/offers';
import { formatCurrency, formatDate } from '@/utils/format';

type StatusTab = 'all' | OfferStatus;
const ALL = '__all';
/** Liste sayfalı çekilir; özet bilgisi ayrı istatistik uç noktasından gelir. */
const NO_SUMMARY = { count: 0, total: 0, months: [] };

/** Teklifler: durum kartları (dokununca o duruma süzer), arama, durum / müşteri / tarih filtreleri ve sayfalı liste. */
export default function OffersScreen() {
  const customers = useCustomers();
  const [status, setStatus] = useState<StatusTab>('all');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounced(search.trim(), 350);
  const [customerId, setCustomerId] = useState(ALL);
  const [startDate, setStartDate] = useState<string | undefined>();
  const [endDate, setEndDate] = useState<string | undefined>();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Durum kartları durum filtresinden bağımsızdır; diğer filtreler (arama, müşteri, tarih) uygulanır.
  const baseFilter = useMemo<Omit<OfferFilter, 'status'>>(
    () => ({ search: debouncedSearch || undefined, customerId: customerId === ALL ? undefined : customerId, startDate, endDate }),
    [debouncedSearch, customerId, startDate, endDate],
  );
  const filter = useMemo<OfferFilter>(() => ({ ...baseFilter, status: status === 'all' ? undefined : status }), [baseFilter, status]);

  const list = useServerList({
    key: JSON.stringify(filter),
    fetchPage: (page, size) => offerService.listPage(filter, page, size),
    fetchSummary: async () => NO_SUMMARY,
    getId: (o: OfferListItem) => o.id,
  });
  const stats = useRemote(JSON.stringify(baseFilter), () => offerService.stats(baseFilter));

  // Detaydan dönünce (durum değişikliği, kopyalama, silme) liste ve sayılar sessizce tazelenir.
  const focused = useRef(false);
  const { refresh: refreshList } = list;
  const { reload: reloadStats } = stats;
  useFocusEffect(
    useCallback(() => {
      if (focused.current) {
        void refreshList();
        reloadStats();
      }
      focused.current = true;
    }, [refreshList, reloadStats]),
  );

  const onPullRefresh = useCallback(async () => {
    setRefreshing(true);
    reloadStats();
    await refreshList();
    setRefreshing(false);
  }, [refreshList, reloadStats]);

  const open = useCallback((o: OfferListItem) => router.push(routes.offer(o.id)), []);
  const customerOptions = useMemo<SelectOption[]>(() => [{ value: ALL, label: 'Tüm müşteriler' }, ...customers.map((c) => ({ value: c.id, label: c.companyName }))], [customers]);
  const customerName = customers.find((c) => c.id === customerId)?.companyName;
  const rangeError = startDate && endDate && startDate > endDate ? 'Bitiş tarihi başlangıçtan önce olamaz.' : undefined;
  const activeFilters = (customerId !== ALL ? 1 : 0) + (startDate || endDate ? 1 : 0);
  const s = stats.data;
  const pick = (tab: StatusTab) => setStatus((cur) => (cur === tab ? 'all' : tab));

  return (
    <Screen>
      <NavHeader
        title="Teklifler"
        subtitle={s ? `${s.total} teklif · Kabul edilen ${formatCurrency(s.acceptedAmount, { decimals: 2 })}` : 'Yükleniyor…'}
        right={
          <>
            <IconButton icon={SlidersHorizontal} label="Filtreler" tone="dark" onPress={() => setFiltersOpen(true)} />
            <IconButton icon={Plus} label="Yeni teklif" tone="dark" onPress={() => router.push(routes.newOffer())} />
          </>
        }>
        <SearchBar value={search} onChange={setSearch} placeholder="Müşteri veya teklif no (AKT-…)" dark />
      </NavHeader>
      {list.loading && list.items.length === 0 ? (
        <LoadingState label="Teklifler yükleniyor" />
      ) : list.error && list.items.length === 0 ? (
        <ErrorState message={list.error} onRetry={() => { list.retry(); reloadStats(); }} />
      ) : (
        <FlatList
          data={list.items}
          keyExtractor={(o) => o.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onPullRefresh} />}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            <View style={{ gap: spacing.md, marginBottom: spacing.md }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.stats} style={styles.statsScroll}>
                <StatTile label="Toplam" value={s?.total ?? '–'} emphasis={status === 'all'} onPress={() => setStatus('all')} />
                <StatTile label="Bekleyen" value={s?.pending ?? '–'} hint={s ? formatCurrency(s.pendingAmount) : undefined} emphasis={status === 'Pending'} onPress={() => pick('Pending')} />
                <StatTile label="Kabul edilen" value={s?.accepted ?? '–'} hint={s ? formatCurrency(s.acceptedAmount) : undefined} emphasis={status === 'Accepted'} onPress={() => pick('Accepted')} />
                <StatTile label="Reddedilen" value={s?.rejected ?? '–'} emphasis={status === 'Rejected'} onPress={() => pick('Rejected')} />
                <StatTile label="Süresi dolan" value={s?.expired ?? '–'} emphasis={status === 'Expired'} onPress={() => pick('Expired')} />
                <StatTile label="Taslak" value={s?.draft ?? '–'} emphasis={status === 'Draft'} onPress={() => pick('Draft')} />
                <StatTile label="İptal" value={s?.cancelled ?? '–'} emphasis={status === 'Cancelled'} onPress={() => pick('Cancelled')} />
              </ScrollView>
              {activeFilters || status !== 'all' ? (
                <View style={styles.chips}>
                  {status !== 'all' ? <Chip label={`Durum: ${OFFER_STATUS_LABEL[status]}`} active onClear={() => setStatus('all')} /> : null}
                  {customerName ? <Chip label={customerName} active onClear={() => setCustomerId(ALL)} /> : null}
                  {startDate || endDate ? (
                    <Chip
                      label={`${startDate ? formatDate(startDate) : '…'} – ${endDate ? formatDate(endDate) : '…'}`}
                      active
                      onClear={() => {
                        setStartDate(undefined);
                        setEndDate(undefined);
                      }}
                    />
                  ) : null}
                </View>
              ) : null}
            </View>
          }
          renderItem={({ item, index }) => (
            <View style={[styles.item, index === 0 && styles.first, index === list.items.length - 1 && styles.last]}>
              <OfferRow offer={item} onPress={open} last={index === list.items.length - 1} />
            </View>
          )}
          onEndReached={list.loadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={<LoadMoreFooter shown={list.items.length} total={list.totalCount} unit="teklif" onMore={list.loadMore} loading={list.loadingMore} />}
          ListEmptyComponent={
            <EmptyState
              icon={FileSignature}
              title={activeFilters || status !== 'all' || debouncedSearch ? 'Filtreye uygun teklif yok' : 'Henüz teklif yok'}
              description="Müşteriye fiyat teklifi hazırlayıp PDF olarak paylaşabilir, kabul edilince nakliye işine dönüştürebilirsiniz."
              action={<Button label="Yeni teklif" size="sm" icon={Plus} onPress={() => router.push(routes.newOffer())} />}
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
                setStartDate(undefined);
                setEndDate(undefined);
              }}
            />
            <Button label="Uygula" style={{ flex: 2 }} disabled={!!rangeError} onPress={() => setFiltersOpen(false)} />
          </View>
        }>
        <View style={{ paddingHorizontal: spacing.xl, gap: spacing.lg }}>
          <SelectField label="Müşteri" options={customerOptions} value={customerId} onChange={setCustomerId} searchable />
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <View style={{ flex: 1 }}>
              <DateField label="Başlangıç" value={startDate ?? null} onChange={setStartDate} hint="Teklif tarihine göre." />
            </View>
            <View style={{ flex: 1 }}>
              <DateField label="Bitiş" value={endDate ?? null} onChange={setEndDate} error={rangeError} />
            </View>
          </View>
        </View>
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.lg, paddingBottom: spacing.huge, flexGrow: 1 },
  statsScroll: { marginHorizontal: -spacing.lg },
  stats: { gap: spacing.sm, paddingHorizontal: spacing.lg },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  item: { backgroundColor: colors.surface, borderLeftWidth: 1, borderRightWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  first: { borderTopWidth: 1, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg },
  last: { borderBottomWidth: 1, borderBottomLeftRadius: radius.lg, borderBottomRightRadius: radius.lg },
});
