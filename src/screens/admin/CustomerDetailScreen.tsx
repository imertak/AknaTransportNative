import { router, useLocalSearchParams } from 'expo-router';
import { FileText, Mail, MapPin, Pencil, Phone, Plus, ReceiptText, Trash2, UserRound } from 'lucide-react-native';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { InvoiceRow } from '@/components/invoices/InvoiceRow';
import { JobRow } from '@/components/jobs/JobRow';
import { Button, Card, EmptyState, IconButton, InfoRow, NavHeader, Screen, ScrollContent, Section, StatTile, Text } from '@/components/ui';
import { useAsyncAction } from '@/hooks/useAsyncAction';
import { useCustomer, useInvoices, useJobs } from '@/hooks/useData';
import { routes } from '@/navigation/routes';
import { customerActions } from '@/store';
import { spacing } from '@/theme';
import type { TransportJob } from '@/types';
import { confirm } from '@/utils/confirm';
import { formatCurrency, formatPhone } from '@/utils/format';
import { callPhone, sendEmail } from '@/utils/links';

const openJob = (job: TransportJob) => router.push(routes.job(job.id));

export default function CustomerDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const customer = useCustomer(id);
  const allJobs = useJobs();
  const allInvoices = useInvoices();
  const { run, pending } = useAsyncAction();

  const jobs = useMemo(() => allJobs.filter((j) => j.customerId === id), [allJobs, id]);
  const invoices = useMemo(() => allInvoices.filter((i) => i.customerId === id), [allInvoices, id]);
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

        <Section title="İletişim">
          <Card padded={false} style={styles.listCard}>
            <InfoRow icon={UserRound} label="Yetkili kişi" value={customer.contactName} />
            <InfoRow icon={Phone} label="Telefon" value={customer.phone ? formatPhone(customer.phone) : '—'} onPress={customer.phone ? () => callPhone(customer.phone) : undefined} />
            <InfoRow icon={Mail} label="E-posta" value={customer.email || '—'} onPress={customer.email ? () => sendEmail(customer.email) : undefined} last />
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
            <Card style={{ paddingVertical: spacing.xs }}>
              {jobs.map((j, i) => (
                <JobRow key={j.id} job={j} onPress={openJob} last={i === jobs.length - 1} />
              ))}
            </Card>
          ) : (
            <EmptyState compact title="Henüz iş yok" description="Bu müşteri için oluşturulan işler burada listelenir." />
          )}
        </Section>

        <Section title={`Kesilen faturalar · ${invoices.length}`} action={invoices.length ? <Text variant="bodySmall" tone="secondary">{formatCurrency(invoicedTotal, { decimals: 2 })}</Text> : undefined}>
          {invoices.length ? (
            <Card padded={false}>
              {invoices.map((inv, i) => (
                <InvoiceRow key={inv.id} invoice={inv} onPress={(x) => router.push(routes.invoice(x.id))} last={i === invoices.length - 1} />
              ))}
            </Card>
          ) : (
            <EmptyState compact icon={ReceiptText} title="Fatura yok" description="Tamamlanan işlerin detayından fatura oluşturabilirsiniz." />
          )}
        </Section>

        {jobs.length === 0 ? <Button label="Müşteriyi sil" variant="danger" icon={Trash2} onPress={remove} loading={pending} /> : null}
      </ScrollContent>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stats: { flexDirection: 'row', gap: spacing.sm },
  listCard: { paddingHorizontal: spacing.lg },
});
