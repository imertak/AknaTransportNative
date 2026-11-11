import { router, useLocalSearchParams } from 'expo-router';
import { Banknote, FileText, Mail, MapPin, Pencil, Phone, Plus, ReceiptText, Trash2, UserRound, Wallet } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { LedgerRow } from '@/components/customers/LedgerRow';
import { MonthlyAccountCards, monthsFromLedger } from '@/components/customers/MonthlyAccountCards';
import { TransactionSheet } from '@/components/customers/TransactionSheet';
import { InvoiceRow } from '@/components/invoices/InvoiceRow';
import { JobRow } from '@/components/jobs/JobRow';
import { Button, Card, EmptyState, IconButton, InfoRow, MonthHeader, NavHeader, Screen, ScrollContent, Section, StatTile, Text } from '@/components/ui';
import { useCustomerLedger } from '@/hooks/useAccounts';
import { useAsyncAction } from '@/hooks/useAsyncAction';
import { useCustomer, useInvoices, useJobs } from '@/hooks/useData';
import { routes } from '@/navigation/routes';
import type { LedgerEntry } from '@/services/accounts';
import { sortJobs } from '@/services/jobUtils';
import { customerActions } from '@/store';
import { spacing } from '@/theme';
import type { TransportJob } from '@/types';
import { confirm } from '@/utils/confirm';
import { formatCurrency, formatDate, formatPhone } from '@/utils/format';
import { callPhone, sendEmail } from '@/utils/links';
import { groupByMonth } from '@/utils/monthGroups';

const openJob = (job: TransportJob) => router.push(routes.job(job.id));

export default function CustomerDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const customer = useCustomer(id);
  const allJobs = useJobs();
  const allInvoices = useInvoices();
  const { run, pending } = useAsyncAction();

  const jobs = useMemo(() => allJobs.filter((j) => j.customerId === id).sort(sortJobs), [allJobs, id]);
  const invoices = useMemo(
    () => allInvoices.filter((i) => i.customerId === id).sort((a, b) => b.issueDate.localeCompare(a.issueDate) || b.invoiceNo.localeCompare(a.invoiceNo)),
    [allInvoices, id],
  );
  const billable = jobs.filter((j) => j.status !== 'cancelled');
  const total = billable.reduce((s, j) => s + j.price, 0);
  const invoicedTotal = invoices.filter((i) => i.status !== 'cancelled').reduce((s, i) => s + i.total, 0);

  if (!customer) {
    return (
      <Screen>
        <NavHeader title="Müşteri" />
        <View style={{ padding: spacing.lg }}>
          <EmptyState title="Müşteri bulunamadı" />
        </View>
      </Screen>
    );
  }

  const remove = async () => {
    const ok = await confirm({ title: 'Müşteriyi sil', message: `${customer.companyName} kaydı silinecek.`, confirmLabel: 'Sil', destructive: true });
    if (!ok) return;
    const done = await run(async () => {
      await customerActions.remove(customer.id);
      return true;
    }, { success: 'Müşteri silindi.' });
    if (done) router.back();
  };

  return (
    <Screen>
      <NavHeader title={customer.companyName} subtitle={customer.contactName} right={<IconButton icon={Pencil} label="Düzenle" tone="dark" onPress={() => router.push(routes.editCustomer(customer.id))} />} />
      <ScrollContent>
        <View style={styles.stats}>
          <StatTile label="Toplam iş" value={billable.length} emphasis />
          <StatTile label="Nakliye tutarı" value={formatCurrency(total)} />
        </View>

        <Button label="Bu müşteri için yeni iş" icon={Plus} onPress={() => router.push(routes.newJob(customer.id))} />

        <AccountSection customerId={customer.id} />

        <Section title="İletişim">
          <Card padded={false} style={styles.listCard}>
            <InfoRow icon={UserRound} label="Yetkili kişi" value={customer.contactName} />
            <InfoRow icon={Phone} label="Telefon" value={customer.phone ? formatPhone(customer.phone) : '—'} onPress={customer.phone ? () => callPhone(customer.phone) : undefined} />
            <InfoRow
              icon={Mail}
              label={customer.extraEmails.length ? 'E-posta (ana)' : 'E-posta'}
              value={customer.email || '—'}
              onPress={customer.email ? () => sendEmail(customer.email) : undefined}
              last={!customer.extraEmails.length}
            />
            {customer.extraEmails.map((m, i) => (
              <InfoRow key={m} icon={Mail} label="E-posta (CC)" value={m} onPress={() => sendEmail(m)} last={i === customer.extraEmails.length - 1} />
            ))}
          </Card>
        </Section>

        <Section title="Fatura bilgileri">
          <Card padded={false} style={styles.listCard}>
            <InfoRow icon={FileText} label="Vergi dairesi / no" value={[customer.taxOffice, customer.taxNumber].filter(Boolean).join(' · ') || '—'} />
            <InfoRow icon={MapPin} label="Fatura adresi" value={customer.billingAddress || '—'} last={!customer.notes} />
            {customer.notes ? <InfoRow label="Açıklama" value={customer.notes} last /> : null}
          </Card>
        </Section>

        <Section title={`Geçmiş nakliye işleri · ${jobs.length}`}>
          {jobs.length ? (
            groupByMonth(jobs, (j) => j.date, (j) => j.id)
              .filter((r) => r.kind === 'month')
              .map((month, m) => (
                <View key={month.key}>
                  <MonthHeader label={month.label} first={m === 0} summary={`${month.items.length} iş`} />
                  <Card style={{ paddingVertical: spacing.xs }}>
                    {month.items.map((j, i) => (
                      <JobRow key={j.id} job={j} onPress={openJob} last={i === month.items.length - 1} />
                    ))}
                  </Card>
                </View>
              ))
          ) : (
            <EmptyState compact title="Henüz iş yok" description="Bu müşteri için oluşturulan işler burada listelenir." />
          )}
        </Section>

        <Section title={`Kesilen faturalar · ${invoices.length}`} action={invoices.length ? <Text variant="bodySmall" tone="secondary">{formatCurrency(invoicedTotal, { decimals: 2 })}</Text> : undefined}>
          {invoices.length ? (
            groupByMonth(invoices, (inv) => inv.issueDate, (inv) => inv.id)
              .filter((r) => r.kind === 'month')
              .map((month, m) => (
                <View key={month.key}>
                  <MonthHeader label={month.label} first={m === 0} summary={`${month.items.length} fatura`} />
                  <Card padded={false}>
                    {month.items.map((inv, i) => (
                      <InvoiceRow key={inv.id} invoice={inv} onPress={(x) => router.push(routes.invoice(x.id))} last={i === month.items.length - 1} />
                    ))}
                  </Card>
                </View>
              ))
          ) : (
            <EmptyState compact icon={ReceiptText} title="Fatura yok" description="Tamamlanan işlerin detayından fatura oluşturabilirsiniz." />
          )}
        </Section>

        {jobs.length === 0 ? <Button label="Müşteriyi sil" variant="danger" icon={Trash2} onPress={remove} loading={pending} /> : null}
      </ScrollContent>
    </Screen>
  );
}

const LEDGER_PREVIEW = 8;

/** Cari hesap: bakiye, gelen/giden tutarlar ve ekstre. Kesilen faturalar otomatik borç olarak görünür. */
function AccountSection({ customerId }: { customerId: string }) {
  const { data, error, loading, reload } = useCustomerLedger(customerId);
  const [sheet, setSheet] = useState<{ entry: LedgerEntry | null } | null>(null);
  const [showAll, setShowAll] = useState(false);

  const openEntry = (e: LedgerEntry) => {
    if (e.kind === 'Invoice' && e.invoiceId) router.push(routes.invoice(e.invoiceId));
    else setSheet({ entry: e });
  };

  const b = data?.balance;
  const entries = useMemo(() => data?.entries ?? [], [data]);
  const visible = showAll ? entries : entries.slice(0, LEDGER_PREVIEW);
  const months = useMemo(() => monthsFromLedger(entries), [entries]);
  // Ekstre de ay ay: her ayın başlığı ve o ayın hareketleri.
  const visibleByMonth = useMemo(() => {
    const groups: { key: string; label: string; items: LedgerEntry[] }[] = [];
    for (const row of groupByMonth(visible, (e) => e.date, (e) => `${e.kind}-${e.id}`)) {
      if (row.kind === 'month') groups.push({ key: row.key, label: row.label, items: row.items });
    }
    return groups;
  }, [visible]);

  return (
    <Section title="Cari hesap">
      {error && !data ? (
        <Card style={{ gap: spacing.sm }}>
          <Text variant="bodySmall" tone="danger">{error}</Text>
          <Button label="Tekrar dene" variant="secondary" size="sm" onPress={reload} />
        </Card>
      ) : (
        <>
          <View style={styles.stats}>
            <StatTile
              label={b && b.balance < 0 ? 'Müşterinin alacağı' : 'Bakiye (alacağımız)'}
              value={b ? formatCurrency(Math.abs(b.balance), { decimals: 2 }) : loading ? '…' : '—'}
              hint={b?.lastMovementDate ? `Son hareket ${formatDate(b.lastMovementDate)}` : undefined}
              emphasis
            />
          </View>
          {data ? <MonthlyAccountCards months={months} /> : null}
          <Button label="Tahsilat / ödeme ekle" icon={Banknote} variant="secondary" onPress={() => setSheet({ entry: null })} />
          {entries.length ? (
            <View>
              {visibleByMonth.map((g, gi) => (
                <View key={g.key}>
                  <MonthHeader label={g.label} first={gi === 0} />
                  <Card padded={false}>
                    {g.items.map((e, i) => (
                      <LedgerRow key={`${e.kind}-${e.id}`} entry={e} onPress={openEntry} last={i === g.items.length - 1} />
                    ))}
                  </Card>
                </View>
              ))}
            </View>
          ) : !loading ? (
            <EmptyState compact icon={Wallet} title="Hareket yok" description="Fatura kesildiğinde veya tahsilat girildiğinde burada görünür." />
          ) : null}
          {entries.length > LEDGER_PREVIEW ? (
            <Button label={showAll ? 'Daha az göster' : `Tüm hareketler (${entries.length})`} variant="ghost" size="sm" onPress={() => setShowAll(!showAll)} />
          ) : null}
        </>
      )}
      <TransactionSheet
        customerId={customerId}
        visible={!!sheet}
        entry={sheet?.entry}
        suggestedAmount={b && b.balance > 0 ? b.balance : undefined}
        onClose={() => setSheet(null)}
      />
    </Section>
  );
}

const styles = StyleSheet.create({
  stats: { flexDirection: 'row', gap: spacing.sm },
  listCard: { paddingHorizontal: spacing.lg },
});
