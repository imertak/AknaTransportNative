import { router } from 'expo-router';
import { ChevronLeft, KeyRound, Lock, MailCheck, Mail } from 'lucide-react-native';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, IconButton, Input, Text } from '@/components/ui';
import { APP_CONFIG } from '@/constants/config';
import { authService } from '@/services';
import { errorMessage } from '@/services/errors';
import { colors, radius, spacing } from '@/theme';
import { isEmail, passwordProblem } from '@/utils/validation';

const apiMode = APP_CONFIG.dataSource === 'api';

export default function ForgotPasswordScreen() {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [resetErrors, setResetErrors] = useState<{ code?: string; password?: string; form?: string }>({});
  const [resetting, setResetting] = useState(false);
  const [done, setDone] = useState(false);

  const reset = async () => {
    const e: typeof resetErrors = {};
    if (!code.trim()) e.code = 'E-postadaki sıfırlama kodunu girin.';
    const problem = passwordProblem(newPassword);
    if (problem) e.password = problem;
    setResetErrors(e);
    if (e.code || e.password) return;
    setResetting(true);
    try {
      await authService.resetPassword(email, code, newPassword);
      setDone(true);
    } catch (err) {
      setResetErrors({ form: errorMessage(err, 'Şifre sıfırlanamadı.') });
    } finally {
      setResetting(false);
    }
  };

  const back = () => (router.canGoBack() ? router.back() : router.replace('/login'));

  const submit = async () => {
    if (!isEmail(email)) {
      setError('Geçerli bir e-posta adresi girin.');
      return;
    }
    setLoading(true);
    try {
      await authService.requestPasswordReset(email);
      setSent(true);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.xl }]} keyboardShouldPersistTaps="handled">
        <IconButton icon={ChevronLeft} label="Geri" onPress={back} tone="dark" />
        <View style={{ gap: spacing.sm, marginTop: spacing.xxl }}>
          <Text variant="display" tone="inverse">Şifremi unuttum</Text>
          <Text tone="inverseMuted">
            {apiMode
              ? 'Hesabınıza kayıtlı e-posta adresini girin. Şifre sıfırlama kodu e-postanıza gönderilecek.'
              : 'Hesabınıza kayıtlı e-posta adresini girin. Şifre sıfırlama talebiniz yöneticinize iletilecektir.'}
          </Text>
        </View>

        <View style={styles.card}>
          {sent && apiMode && done ? (
            <View style={{ gap: spacing.md, alignItems: 'flex-start' }}>
              <View style={styles.icon}>
                <Lock size={22} color={colors.text} />
              </View>
              <Text variant="heading">Şifreniz güncellendi</Text>
              <Text variant="bodySmall" tone="secondary">Yeni şifrenizle giriş yapabilirsiniz. Diğer cihazlardaki oturumlarınız kapatıldı.</Text>
              <Button label="Girişe dön" onPress={back} fullWidth />
            </View>
          ) : sent && apiMode ? (
            <View style={{ gap: spacing.lg }}>
              <Text variant="bodySmall" tone="secondary">
                {email} adresi kayıtlıysa sıfırlama kodu gönderildi. Kodu ve yeni şifrenizi girin.
              </Text>
              {resetErrors.form ? (
                <Text variant="bodySmall" tone="danger" accessibilityRole="alert">{resetErrors.form}</Text>
              ) : null}
              <Input label="Sıfırlama kodu" icon={KeyRound} value={code} onChangeText={setCode} autoCapitalize="none" autoCorrect={false} error={resetErrors.code} />
              <Input
                label="Yeni şifre"
                icon={Lock}
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
                autoComplete="new-password"
                textContentType="newPassword"
                returnKeyType="go"
                onSubmitEditing={reset}
                error={resetErrors.password}
                hint="En az 8 karakter, en az bir harf ve bir rakam."
              />
              <Button label="Şifreyi güncelle" onPress={reset} loading={resetting} size="lg" fullWidth />
            </View>
          ) : sent ? (
            <View style={{ gap: spacing.md, alignItems: 'flex-start' }}>
              <View style={styles.icon}>
                <MailCheck size={22} color={colors.text} />
              </View>
              <Text variant="heading">Talebiniz alındı</Text>
              <Text variant="bodySmall" tone="secondary">
                {email} için sıfırlama talebi kaydedildi. Demo sürümünde e-posta gönderilmez; şifre sıfırlama bağlantıları API entegrasyonuyla birlikte etkinleşecektir.
              </Text>
              <Button label="Girişe dön" onPress={back} fullWidth />
            </View>
          ) : (
            <>
              <Input
                label="E-posta"
                icon={Mail}
                value={email}
                onChangeText={(v) => {
                  setEmail(v);
                  setError(undefined);
                }}
                placeholder="ornek@akna.com"
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
                returnKeyType="send"
                onSubmitEditing={submit}
                error={error}
                autoFocus
              />
              <Button label="Sıfırlama talebi gönder" onPress={submit} loading={loading} size="lg" fullWidth />
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink },
  scroll: { flexGrow: 1, paddingHorizontal: spacing.xl, gap: spacing.xxl, maxWidth: 480, width: '100%', alignSelf: 'center' },
  card: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.xxl, gap: spacing.lg },
  icon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surfaceSunken, alignItems: 'center', justifyContent: 'center' },
});
