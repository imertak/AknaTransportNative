import Constants from 'expo-constants';
import { router } from 'expo-router';
import { ArrowLeftRight, Database, LogOut, Mail, Phone, ReceiptText, RotateCcw, Truck } from 'lucide-react-native';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Avatar, Badge, Card, InfoRow, ListItem, PageHeader, Screen, Section, Text } from '@/components/ui';
import { APP_CONFIG } from '@/constants/config';
import { can } from '@/constants/permissions';
import { VEHICLE_TYPE_LABEL } from '@/constants/vehicles';
import { useAuth, useCurrentUser } from '@/contexts/AuthContext';
import { useLocationTracking } from '@/contexts/LocationContext';
import { useAsyncAction } from '@/hooks/useAsyncAction';
import { useVehicles } from '@/hooks/useData';
import { routes } from '@/navigation/routes';
import { resetDemoData } from '@/store';
import { colors, spacing } from '@/theme';
import { confirm } from '@/utils/confirm';
import { formatPhone } from '@/utils/format';

export default function ProfileScreen() {
  const user = useCurrentUser();
  const { viewMode, setViewMode, signOut } = useAuth();
  const { stopSharing } = useLocationTracking();
  const vehicles = useVehicles();
  const vehicle = vehicles.find((v) => v.id === user.vehicleId);
  const { run } = useAsyncAction();

  const logout = async () => {
    if (!(await confirm({ title: 'Çıkış yap', message: 'Oturumunuz kapatılacak.', confirmLabel: 'Çıkış yap', destructive: true }))) return;
    stopSharing();
    await signOut();
  };

  const reset = async () => {
    const ok = await confirm({
      title: 'Demo verilerini sıfırla',
      message: 'Cihazdaki tüm demo işler, müşteriler ve faturalar başlangıç durumuna döner.',
      confirmLabel: 'Sıfırla',
      destructive: true,
    });
    if (ok) await run(resetDemoData, { success: 'Demo verileri sıfırlandı.' });
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.huge }} showsVerticalScrollIndicator={false}>
        <PageHeader title="Profil">
          <View style={styles.identity}>
            <Avatar name={user.fullName} size={56} dark />
            <View style={{ flex: 1, gap: 4 }}>
              <Text variant="heading" tone="inverse">{user.fullName}</Text>
              <Badge label={user.role === 'admin' ? 'Yönetici' : 'Şoför'} tone="outline" />
            </View>
          </View>
        </PageHeader>

        <View style={styles.body}>
          <Section title="Hesap">
            <Card padded={false} style={{ paddingHorizontal: spacing.lg }}>
              <InfoRow icon={Mail} label="E-posta" value={user.email} />
              <InfoRow icon={Phone} label="Telefon" value={formatPhone(user.phone)} />
              <InfoRow icon={Truck} label="Araç" value={vehicle ? `${vehicle.plate} · ${vehicle.model} (${VEHICLE_TYPE_LABEL[vehicle.type]})` : 'Tanımlı araç yok'} last />
            </Card>
          </Section>

          {can(user, 'viewMode.switch') ? (
            <Section title="Görünüm">
              <Card padded={false}>
                <ListItem
                  icon={ArrowLeftRight}
                  title={viewMode === 'admin' ? 'Şoför görünümüne geç' : 'Yönetici görünümüne dön'}
                  subtitle={viewMode === 'admin' ? 'Üstlendiğiniz işleri şoför ekranlarından yürütün.' : 'Operasyon paneline geri dönün.'}
                  onPress={() => setViewMode(viewMode === 'admin' ? 'driver' : 'admin')}
                />
                {viewMode === 'admin' ? (
                  <>
                    <View style={styles.sep} />
                    <ListItem icon={ReceiptText} title="Faturalar" subtitle="Demo fatura geçmişi" onPress={() => router.push(routes.invoices)} />
                  </>
                ) : null}
              </Card>
            </Section>
          ) : null}

          <Section title="Uygulama">
            <Card padded={false}>
              <ListItem
                icon={Database}
                title="Veri kaynağı"
                subtitle={APP_CONFIG.dataSource === 'mock' ? 'Demo veriler · cihazda saklanır' : 'AKNA API'}
                right={<Badge label={APP_CONFIG.dataSource === 'mock' ? 'Demo' : 'Canlı'} />}
              />
              {APP_CONFIG.dataSource === 'mock' ? (
                <>
                  <View style={styles.sep} />
                  <ListItem icon={RotateCcw} title="Demo verilerini sıfırla" onPress={reset} />
                </>
              ) : null}
              <View style={styles.sep} />
              <ListItem icon={LogOut} title="Çıkış yap" destructive onPress={logout} />
            </Card>
          </Section>

          <Text variant="bodySmall" tone="tertiary" align="center">
            {APP_CONFIG.appName} · Sürüm {Constants.expoConfig?.version ?? '1.0.0'}
          </Text>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  identity: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  body: { padding: spacing.lg, gap: spacing.xl },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: colors.borderStrong, marginLeft: 64 },
});
