import { router, useLocalSearchParams } from 'expo-router';
import { Ban, Building2, CalendarDays, CarFront, FileText, Hand, Mail, Pencil, Phone, ReceiptText, Truck, UserRound, UserRoundCog } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { DriverActionCard } from '@/components/jobs/DriverActionCard';
import { LocationShareCard } from '@/components/jobs/LocationShareCard';
import { BillingStatusBadge } from '@/components/jobs/BillingStatusBadge';
import { StopList } from '@/components/jobs/StopList';
import { StatusTimeline } from '@/components/jobs/StatusTimeline';
import { Button, Card, EmptyState, IconButton, InfoRow, NavHeader, OptionSheet, Screen, ScrollContent, Section, StatusBadge, Text, type SelectOption } from '@/components/ui';
import { isClosed, isTrackable } from '@/constants/jobStatus';
import { can } from '@/constants/permissions';
import { VEHICLE_TYPE_LABEL } from '@/constants/vehicles';
import { useAuth, useCurrentUser } from '@/contexts/AuthContext';
import { useLocationTracking } from '@/contexts/LocationContext';
import { useAsyncAction } from '@/hooks/useAsyncAction';
import { useAssignableUsers, useCustomer, useInvoice, useJob, useUserMap, useVehicles } from '@/hooks/useData';
import { routes } from '@/navigation/routes';
import { jobActions } from '@/store';
import { colors, spacing } from '@/theme';
import { confirm } from '@/utils/confirm';
import { formatCurrency, formatDateLong, formatPhone } from '@/utils/format';
import { callPhone, sendEmail } from '@/utils/links';

const UNASSIGN = '__unassign';
const NO_VEHICLE = '__none';

/** Atama akışı: önce şoför, sonra (varsa) o şoförün aktif araçlarından biri. */
type AssignStep = { kind: 'driver' } | { kind: 'vehicle'; driverId: string; purpose: 'assign' | 'claim' } | null;

export default function JobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useCurrentUser();
  const { viewMode } = useAuth();
  const job = useJob(id);
  const customer = useCustomer(job?.customerId);
  const invoice = useInvoice(job?.invoiceId);
  const userMap = useUserMap();
  const assignable = useAssignableUsers();
  const vehicles = useVehicles();
  const { ensureReady, startNow } = useLocationTracking();
  const { run, pending } = useAsyncAction();
  const [step, setStep] = useState<AssignStep>(null);

  // Liste verisinde durum geçmişi yoktur (API); detay açılınca iş tazelenir.
  useEffect(() => {
    if (id) jobActions.refresh(id).catch(() => {});
  }, [id]);

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

  const vehiclesOf = (driverId: string) => vehicles.filter((v) => v.isActive && v.driverId === driverId);

  const doAssign = async (driverId: string | null, vehicleId?: string) => {
    await run(() => jobActions.assign(job.id, driverId, user.id, vehicleId ?? null), {
      success: driverId ? `İş ${userMap.get(driverId)?.fullName ?? ''} kullanıcısına atandı.` : 'Atama kaldırıldı.',
    });
  };

  const pickDriver = (value: string) => {
    if (value === UNASSIGN) return void doAssign(null);
    const own = vehiclesOf(value);
    // OptionSheet kapanma animasyonundan sonra araç seçimi açılır.
    if (own.length > 1) setTimeout(() => setStep({ kind: 'vehicle', driverId: value, purpose: 'assign' }), 250);
    else void doAssign(value, own[0]?.id);
  };

  const doClaim = async (vehicleId?: string) => {
    // Üstlenilen iş kabul edilmiş sayılır; konum takibi zorunlu olduğundan önce izinler kontrol edilir.
    const ready = await ensureReady();
    if (!ready.ok) {
      await confirm({ title: 'Konum izni gerekli', message: ready.message, confirmLabel: 'Tamam' });
      return;
    }
    const claimed = await run(() => jobActions.takeOver(job.id, user.id, vehicleId ?? null));
    if (!claimed) return;
    await startNow().catch(() => {});
  };

  const takeOver = async () => {
    const ok = await confirm({
      title: 'İşi üstlen',
      message: 'Bu iş size atanacak ve kabul edilmiş sayılacak. Kabul ile konum takibi başlar; şoför ekranlarından yürütebilirsiniz.',
      confirmLabel: 'Üstlen',
    });
    if (!ok) return;
    const own = vehiclesOf(user.id);
    if (own.length > 1) setStep({ kind: 'vehicle', driverId: user.id, purpose: 'claim' });
    else await doClaim(own[0]?.id);
  };

  const vehicleStepOptions: SelectOption[] =
    step?.kind === 'vehicle'
      ? [
          ...vehiclesOf(step.driverId).map((v) => ({ value: v.id, label: v.plate, description: [v.brand, v.model].filter(Boolean).join(' ') })),
          { value: NO_VEHICLE, label: 'Araç seçmeden devam et', description: 'Araç daha sonra seçilebilir' },
        ]
      : [];

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
              <CalendarDays size={15} color={colors.textTertiary} />
              <Text variant="bodySmall" tone="secondary">{formatDateLong(job.date)}</Text>
            </View>
            <View style={styles.meta}>
              <Truck size={15} color={colors.textTertiary} />
              <Text variant="bodySmall" tone="secondary">{VEHICLE_TYPE_LABEL[job.vehicleType]}</Text>
            </View>
            {job.vehiclePlate ? (
              <View style={styles.meta}>
                <CarFront size={15} color={colors.textTertiary} />
                <Text variant="bodySmall" tone="secondary">{job.vehiclePlate}</Text>
              </View>
            ) : null}
          </View>
          {isAdminView && job.status === 'completed' ? <BillingStatusBadge status={job.billingStatus} /> : null}
        </Card>

        {isMine ? <DriverActionCard job={job} /> : null}
        {isMine && isTrackable(job.status) ? <LocationShareCard /> : null}

        <Section title={`Güzergah · ${job.stops.length} durak`}>
          <Card style={{ gap: spacing.lg }}>
            <StopList stops={job.stops} navigable={!closed} />
          </Card>
        </Section>

        <Section title="Yapılan nakliye">
          <Card style={{ gap: spacing.md }}>
            <Text>{job.routeDescription || '—'}</Text>
            {job.description ? (
              <View style={styles.notes}>
                <Text variant="caption" tone="tertiary">Açıklama</Text>
                <Text variant="bodySmall" tone="secondary">{job.description}</Text>
              </View>
            ) : null}
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
            <InfoRow icon={UserRoundCog} label="Şoför" value={driver ? `${driver.fullName}${driver.id === user.id ? ' (Ben)' : ''}` : 'Atanmadı'} />
            <InfoRow icon={CarFront} label="Araç" value={job.vehiclePlate ?? 'Seçilmedi'} last />
            {isAdminView && !closed ? (
              <View style={styles.row}>
                <Button label={driver ? 'Şoförü değiştir' : 'Şoföre ata'} variant="secondary" size="sm" icon={UserRoundCog} onPress={() => setStep({ kind: 'driver' })} style={{ flex: 1 }} />
                {!isMine && can(user, 'jobs.takeOver') ? <Button label="İşi üstlen" variant="secondary" size="sm" icon={Hand} onPress={takeOver} style={{ flex: 1 }} /> : null}
              </View>
            ) : null}
          </Card>
        </Section>

        {isAdminView && job.status === 'completed' ? (
          <Section title="Fatura">
            {invoice ? (
              <Card onPress={() => router.push(routes.invoice(invoice.id))} style={styles.invoice}>
                <ReceiptText size={20} color={colors.text} />
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

      <OptionSheet visible={step?.kind === 'driver'} onClose={() => setStep(null)} title="Şoför seç" options={assignOptions} value={job.driverId} onSelect={pickDriver} searchable />
      <OptionSheet
        visible={step?.kind === 'vehicle'}
        onClose={() => setStep(null)}
        title="Araç seç"
        options={vehicleStepOptions}
        value={job.vehicleId ?? null}
        onSelect={(v) => {
          const current = step;
          if (current?.kind !== 'vehicle') return;
          const vehicleId = v === NO_VEHICLE ? undefined : v;
          if (current.purpose === 'claim') void doClaim(vehicleId);
          else void doAssign(current.driverId, vehicleId);
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  summary: { gap: spacing.sm },
  summaryTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  row: { flexDirection: 'row', gap: spacing.sm },
  notes: { gap: 2, paddingTop: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderStrong },
  listCard: { paddingHorizontal: spacing.lg },
  invoice: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
});
