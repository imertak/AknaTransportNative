import Constants from 'expo-constants';
import { router } from 'expo-router';
import { ArrowLeftRight, BadgeCheck, CarFront, Database, KeyRound, Lock, LogOut, Mail, Phone, ShieldUser, Truck, UserRound } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Avatar, Badge, Button, Card, InfoRow, Input, ListItem, NavHeader, Screen, ScrollContent, Section, Sheet, Text } from '@/components/ui';
import { APP_CONFIG } from '@/constants/config';
import { can } from '@/constants/permissions';
import { VEHICLE_TYPE_LABEL } from '@/constants/vehicles';
import { useAuth, useCurrentUser } from '@/contexts/AuthContext';
import { useLocationTracking } from '@/contexts/LocationContext';
import { useToast } from '@/contexts/ToastContext';
import { useDriverVehicles } from '@/hooks/useData';
import { routes } from '@/navigation/routes';
import { errorMessage } from '@/services/errors';
import { colors, radius, spacing } from '@/theme';
import { confirm } from '@/utils/confirm';
import { formatPhone } from '@/utils/format';
import { passwordProblem } from '@/utils/validation';

/** Yönetici ve şoför görünümlerinde ortak profil ekranı (yığın ekranı; geri butonuyla kapanır). */
export default function ProfileScreen() {
  const user = useCurrentUser();
  const { viewMode, setViewMode, signOut } = useAuth();
  const { stopSharing } = useLocationTracking();
  const vehicles = useDriverVehicles(user.id);
  const [passwordOpen, setPasswordOpen] = useState(false);

  const logout = async () => {
    if (!(await confirm({ title: 'Çıkış yap', message: 'Oturumunuz kapatılacak.', confirmLabel: 'Çıkış yap', destructive: true }))) return;
    await stopSharing();
    await signOut();
  };

  const switchView = () => {
    const next = viewMode === 'admin' ? 'driver' : 'admin';
    setViewMode(next);
    router.replace(routes.home(next));
  };

  return (
    <Screen>
      <NavHeader title="Profilim" subtitle={user.role === 'admin' ? 'Yönetici hesabı' : 'Şoför hesabı'} />
      <ScrollContent>
        <Card style={styles.identity}>
          <Avatar name={user.fullName} size={56} />
          <View style={{ flex: 1, gap: 4 }}>
            <Text variant="heading">{user.fullName}</Text>
            <View style={styles.badges}>
              <Badge label={user.role === 'admin' ? 'Yönetici' : 'Şoför'} tone="solid" />
              <Badge label={user.isActive ? 'Aktif' : 'Pasif'} tone={user.isActive ? 'outline' : 'danger'} />
            </View>
          </View>
        </Card>

        <Section title="Hesap bilgileri">
          <Card padded={false} style={styles.listCard}>
            <InfoRow icon={UserRound} label="Ad soyad" value={user.fullName} />
            <InfoRow icon={Mail} label="E-posta" value={user.email} />
            <InfoRow icon={Phone} label="Telefon" value={user.phone ? formatPhone(user.phone) : 'Kayıtlı değil'} />
            <InfoRow icon={ShieldUser} label="Rol" value={user.role === 'admin' ? 'Yönetici' : 'Şoför'} />
            <InfoRow icon={BadgeCheck} label="Hesap durumu" value={user.isActive ? 'Aktif' : 'Pasif'} last />
          </Card>
        </Section>

        <Section title="Güvenlik">
          <Card padded={false}>
            <ListItem icon={KeyRound} title="Şifre değiştir" subtitle="Mevcut şifrenizle yeni şifre belirleyin" onPress={() => setPasswordOpen(true)} />
          </Card>
        </Section>

        <Section
          title="Araçlarım"
          action={can(user, 'vehicles.manage') ? <Button label="Araç yönetimi" variant="ghost" size="sm" onPress={() => router.push(routes.vehicles)} /> : undefined}>
          <Card padded={false} style={styles.listCard}>
            {vehicles.length ? (
              vehicles.map((v, i) => (
                <InfoRow
                  key={v.id}
                  icon={Truck}
                  label={v.plate}
                  value={`${[v.brand, v.model].filter(Boolean).join(' ') || 'Model belirtilmedi'} · ${VEHICLE_TYPE_LABEL[v.type]}`}
                  last={i === vehicles.length - 1}
                />
              ))
            ) : (
              <InfoRow icon={CarFront} label="Araç" value="Size atanmış aktif araç yok. Araç ataması yönetici tarafından yapılır." last />
            )}
          </Card>
        </Section>

        {can(user, 'viewMode.switch') ? (
          <Section title="Görünüm">
            <Card padded={false}>
              <ListItem
                icon={ArrowLeftRight}
                title={viewMode === 'admin' ? 'Şoför görünümüne geç' : 'Yönetici görünümüne dön'}
                subtitle={viewMode === 'admin' ? 'Üstlendiğiniz işleri şoför ekranlarından yürütün. Rolünüz değişmez.' : 'Operasyon paneline geri dönün.'}
                onPress={switchView}
              />
            </Card>
          </Section>
        ) : null}

        <Section title="Uygulama">
          <Card padded={false}>
            <ListItem
              icon={Database}
              title="Sunucu"
              subtitle={APP_CONFIG.apiBaseUrl || 'API adresi yapılandırılmadı'}
            />
            <View style={styles.sep} />
            <ListItem icon={LogOut} title="Çıkış yap" destructive onPress={logout} />
          </Card>
        </Section>

        <Text variant="bodySmall" tone="tertiary" align="center">
          {APP_CONFIG.appName} · Sürüm {Constants.expoConfig?.version ?? '1.0.0'}
        </Text>
      </ScrollContent>

      <ChangePasswordSheet visible={passwordOpen} onClose={() => setPasswordOpen(false)} />
    </Screen>
  );
}

function ChangePasswordSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { changePassword } = useAuth();
  const toast = useToast();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [errors, setErrors] = useState<{ current?: string; next?: string; again?: string; form?: string }>({});
  const [loading, setLoading] = useState(false);

  const close = () => {
    setCurrent('');
    setNext('');
    setAgain('');
    setErrors({});
    onClose();
  };

  const submit = async () => {
    const e: typeof errors = {};
    if (!current) e.current = 'Mevcut şifrenizi girin.';
    const problem = passwordProblem(next);
    if (problem) e.next = problem;
    else if (next === current) e.next = 'Yeni şifre mevcut şifreden farklı olmalıdır.';
    if (!e.next && next !== again) e.again = 'Şifreler eşleşmiyor.';
    setErrors(e);
    if (Object.keys(e).length) return;
    setLoading(true);
    try {
      await changePassword(current, next);
      toast.show('Şifreniz değiştirildi.', 'success');
      close();
    } catch (err) {
      setErrors({ form: errorMessage(err, 'Şifre değiştirilemedi.') });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet
      visible={visible}
      onClose={close}
      title="Şifre değiştir"
      subtitle="Diğer cihazlardaki oturumlarınız kapatılabilir."
      footer={<Button label="Şifreyi kaydet" onPress={submit} loading={loading} fullWidth />}>
      <View style={{ gap: spacing.lg }}>
        {errors.form ? (
          <View style={styles.formError} accessibilityRole="alert">
            <Text variant="bodySmall" tone="danger">{errors.form}</Text>
          </View>
        ) : null}
        <Input label="Mevcut şifre" icon={KeyRound} value={current} onChangeText={setCurrent} secureTextEntry autoComplete="current-password" textContentType="password" error={errors.current} />
        <Input label="Yeni şifre" icon={Lock} value={next} onChangeText={setNext} secureTextEntry autoComplete="new-password" textContentType="newPassword" error={errors.next} hint="En az 8 karakter, en az bir harf ve bir rakam." />
        <Input label="Yeni şifre (tekrar)" icon={Lock} value={again} onChangeText={setAgain} secureTextEntry autoComplete="new-password" textContentType="newPassword" returnKeyType="go" onSubmitEditing={submit} error={errors.again} />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  identity: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  badges: { flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' },
  listCard: { paddingHorizontal: spacing.lg },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: colors.borderStrong, marginLeft: 64 },
  formError: { backgroundColor: colors.dangerSoft, borderRadius: radius.sm, padding: spacing.md },
});
