import { router } from 'expo-router';
import { ChevronLeft, MailCheck, Mail } from 'lucide-react-native';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, IconButton, Input, Text } from '@/components/ui';
import { authService } from '@/services';
import { errorMessage } from '@/services/errors';
import { colors, radius, spacing } from '@/theme';
import { isEmail } from '@/utils/validation';

export default function ForgotPasswordScreen() {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

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
          <Text tone="inverseMuted">Hesabınıza kayıtlı e-posta adresini girin. Şifre sıfırlama talebiniz yöneticinize iletilecektir.</Text>
        </View>

        <View style={styles.card}>
          {sent ? (
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
