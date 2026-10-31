import { router, useLocalSearchParams } from 'expo-router';
import { Ban, Building2, CalendarDays, FileText, Hand, Mail, Navigation, Pencil, Phone, ReceiptText, Truck, UserRound, UserRoundCog } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { DriverActionCard } from '@/components/jobs/DriverActionCard';
import { LocationShareCard } from '@/components/jobs/LocationShareCard';
import { RouteLine } from '@/components/jobs/RouteLine';
import { StatusTimeline } from '@/components/jobs/StatusTimeline';
import { Button, Card, EmptyState, IconButton, InfoRow, NavHeader, OptionSheet, Screen, ScrollContent, Section, StatusBadge, Text, type SelectOption } from '@/components/ui';
import { isClosed, isTrackable } from '@/constants/jobStatus';
import { can } from '@/constants/permissions';
import { VEHICLE_TYPE_LABEL } from '@/constants/vehicles';
import { useAuth, useCurrentUser } from '@/contexts/AuthContext';
import { useAsyncAction } from '@/hooks/useAsyncAction';
import { useAssignableUsers, useCustomer, useInvoice, useJob, useUserMap } from '@/hooks/useData';
import { routes } from '@/navigation/routes';
import { jobActions } from '@/store';
import { spacing } from '@/theme';
import { confirm } from '@/utils/confirm';
import { formatCurrency, formatDateLong, formatPhone } from '@/utils/format';
import { callPhone, openDirections, sendEmail } from '@/utils/links';

const UNASSIGN = '__unassign';

export default function JobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useCurrentUser();
  const { viewMode } = useAuth();
  const job = useJob(id);
  const customer = useCustomer(job?.customerId);
  const invoice = useInvoice(job?.invoiceId);
  const userMap = useUserMap();
  const assignable = useAssignableUsers();
  const { run, pending } = useAsyncAction();
  const [assignOpen, setAssignOpen] = useState(false);

  const assignOptions = useMemo<SelectOption[]>(
    () => [
      ...assignable.map((u) => ({ value: u.id, label: u.id === user.id ? `${u.fullName} (Ben)` : u.fullName, description: u.role === 'admin' ? 'Yönetici' : 'Şoför' })),
      ...(job?.driverId ? [{ value: UNASSIGN, label: 'Atamayı kaldır', description: 'İş Bekliyor durumuna döner' }] : []),
    ],
    [assignable, user.id, job?.driverId],
  );

  const isAdminView = viewMode === 'admin' && can(user, 'jobs.edit');
  const isMine = !!job && job.driverId === user.id;

  if (!job || (!isAdminView && !isMine && !can(user, 'jobs.viewAll'))) {
    return (
      <Screen>
        <NavHeader title="İş detayı" />
        <View style={{ padding: spacing.lg }}>
          <EmptyState title="İş bulunamadı" description="Bu iş kaldırılmış olabilir veya size atanmamış." />
        </View>
      </Screen>
    );
  }

  const showPrice = can(user, 'jobs.viewPrice');
  const driver = job.driverId ? userMap.get(job.driverId) : undefined;
  const closed = isClosed(job.status);

  const assign = async (value: string) => {
    const driverId = value === UNASSIGN ? null : value;
    await run(() => jobActions.assign(job.id, driverId, user.id), {
      success: driverId ? `İş ${userMap.get(driverId)?.fullName ?? ''} kullanıcısına atandı.` : 'Atama kaldırıldı.',
    });
  };

  const takeOver = async () => {
    const ok = await confirm({ title: 'İşi üstlen', message: 'Bu iş size atanacak ve kabul edilmiş sayılacak. Şoför ekranlarından takip edebilirsiniz.', confirmLabel: 'Üstlen' });
    if (ok) await run(() => jobActions.takeOver(job.id, user.id), { success: 'İşi üstlendiniz.' });
  };

  const cancel = async () => {
    const ok = await confirm({ title: 'İşi iptal et', message: `${job.jobNo} numaralı iş iptal edilecek. Bu işlem geri alınamaz.`, confirmLabel: 'İptal et', destructive: true });
    if (ok) await run(() => jobActions.cancel(job.id, user.id), { success: 'İş iptal edildi.' });
  };

  return (
    <Screen>
      <NavHeader
        title={job.jobNo}
        subtitle={job.customerName}
        right={isAdminView && job.status !== 'cancelled' ? <IconButton icon={Pencil} label="Düzenle" tone="dark" onPress={() => router.push(routes.editJob(job.id))} /> : undefined}
      />
      <ScrollContent>
        <Card style={styles.summary}>
          <View style={styles.summaryTop}>
            <StatusBadge status={job.status} />
            {showPrice ? <Text variant="title" style={{ fontVariant: ['tabular-nums'] }}>{formatCurrency(job.price)}</Text> : null}
          </View>
          <Text variant="heading">{job.storeName}</Text>
          <View style={styles.metaRow}>
            <View style={styles.meta}>
              <CalendarDays size={15} color="#8A8A8F" />
              <Text variant="bodySmall" tone="secondary">{formatDateLong(job.date)}</Text>
            </View>
            <View style={styles.meta}>
              <Truck size={15} color="#8A8A8F" />
              <Text variant="bodySmall" tone="secondary">{VEHICLE_TYPE_LABEL[job.vehicleType]}</Text>
            </View>
          </View>
        </Card>

        {isMine ? <DriverActionCard job={job} /> : null}
        {isMine && isTrackable(job.status) ? <LocationShareCard /> : null}

        <Section title="Güzergah">
          <Card style={{ gap: spacing.lg }}>
            <RouteLine pickup={job.pickupAddress} delivery={job.deliveryAddress} />
            {!closed ? (
              <View style={styles.row}>
                <Button label="Yüklemeye git" variant="secondary" size="sm" icon={Navigation} onPress={() => openDirections(job.pickupAddress, job.pickupPoint)} style={{ flex: 1 }} />
                <Button label="Teslimata git" variant="secondary" size="sm" icon={Navigation} onPress={() => openDirections(job.deliveryAddress, job.deliveryPoint)} style={{ flex: 1 }} />
              </View>
            ) : null}
          </Card>
        </Section>

        <Section title="Yapılan nakliye">
          <Card style={{ gap: spacing.md }}>
            <Text>{job.description}</Text>
            {job.notes ? (
              <View style={styles.notes}>
                <Text variant="caption" tone="tertiary">Ek açıklama</Text>
                <Text variant="bodySmall" tone="secondary">{job.notes}</Text>
              </View>
            ) : null}
          </Card>
        </Section>

        <Section title="Müşteri">
          <Card padded={false} style={styles.listCard}>
            <InfoRow icon={Building2} label="Firma" value={job.customerName} onPress={isAdminView && customer ? () => router.push(routes.customer(customer.id)) : undefined} />
            {customer?.contactName ? <InfoRow icon={UserRound} label="Yetkili" value={customer.contactName} /> : null}
            {customer?.phone ? <InfoRow icon={Phone} label="Telefon" value={formatPhone(customer.phone)} onPress={() => callPhone(customer.phone)} /> : null}
            {isAdminView && customer?.email ? <InfoRow icon={Mail} label="E-posta" value={customer.email} onPress={() => sendEmail(customer.email)} last /> : null}
          </Card>
        </Section>

        <Section title="Atama">
          <Card style={{ gap: spacing.md }}>
            <InfoRow icon={UserRoundCog} label="Şoför" value={driver ? `${driver.fullName}${driver.id === user.id ? ' (Ben)' : ''}` : 'Atanmadı'} last />
            {isAdminView && !closed ? (
              <View style={styles.row}>
                <Button label={driver ? 'Şoförü değiştir' : 'Şoföre ata'} variant="secondary" size="sm" icon={UserRoundCog} onPress={() => setAssignOpen(true)} style={{ flex: 1 }} />
                {!isMine && can(user, 'jobs.takeOver') ? <Button label="İşi üstlen" variant="secondary" size="sm" icon={Hand} onPress={takeOver} style={{ flex: 1 }} /> : null}
              </View>
            ) : null}
          </Card>
        </Section>

        {isAdminView && job.status === 'completed' ? (
          <Section title="Fatura">
            {invoice ? (
              <Card onPress={() => router.push(routes.invoice(invoice.id))} style={styles.invoice}>
                <ReceiptText size={20} color="#0B0B0C" />
                <View style={{ flex: 1 }}>
                  <Text variant="subheading">{invoice.invoiceNo}</Text>
                  <Text variant="bodySmall" tone="secondary">{invoice.mode === 'demo' ? 'Demo fatura · resmi değildir' : 'e-Arşiv faturası'} · {formatCurrency(invoice.total, { decimals: 2 })}</Text>
                </View>
              </Card>
            ) : (
              <Card style={{ gap: spacing.md }}>
                <Text variant="bodySmall" tone="secondary">Bu iş için henüz fatura oluşturulmadı.</Text>
                <Button label="Fatura oluştur" icon={FileText} onPress={() => router.push(routes.newInvoice(job.id))} />
              </Card>
            )}
          </Section>
        ) : null}

        <Section title="Durum geçmişi">
          <Card>
            <StatusTimeline events={job.statusHistory} users={userMap} />
          </Card>
        </Section>

        {isAdminView && !closed ? <Button label="İşi iptal et" variant="danger" icon={Ban} onPress={cancel} loading={pending} /> : null}
      </ScrollContent>

      <OptionSheet visible={assignOpen} onClose={() => setAssignOpen(false)} title="Şoför seç" options={assignOptions} value={job.driverId} onSelect={assign} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  summary: { gap: spacing.sm },
  summaryTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  row: { flexDirection: 'row', gap: spacing.sm },
  notes: { gap: 2, paddingTop: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#CFCFCC' },
  listCard: { paddingHorizontal: spacing.lg },
  invoice: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
});
