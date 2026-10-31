import { KeyRound, Lock } from 'lucide-react-native';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Input, Text } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';
import { errorMessage } from '@/services/errors';
import { colors, radius, spacing } from '@/theme';
import { passwordProblem } from '@/utils/validation';

/**
 * Yönetici tarafından SMS ile gönderilen geçici şifreyle yapılan ilk girişte açılır.
 * Yeni şifre belirlenmeden uygulamanın diğer ekranlarına geçilemez.
 */
export default function ChangePasswordScreen() {
  const { user, changePassword, signOut } = useAuth();
  const insets = useSafeAreaInsets();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<{ current?: string; next?: string; confirm?: string; form?: string }>({});
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    const e: typeof errors = {};
    if (!current) e.current = 'Size gönderilen geçici şifreyi girin.';
    const problem = passwordProblem(next);
    if (problem) e.next = problem;
    else if (next === current) e.next = 'Yeni şifre geçici şifreden farklı olmalıdır.';
    if (!e.next && next !== confirm) e.confirm = 'Şifreler eşleşmiyor.';
    setErrors(e);
    if (Object.keys(e).length) return;
    setLoading(true);
    try {
      await changePassword(current, next);
    } catch (err) {
      setErrors({ form: errorMessage(err, 'Şifre değiştirilemedi.') });
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + spacing.huge, paddingBottom: insets.bottom + spacing.xl }]} keyboardShouldPersistTaps="handled">
        <View style={{ gap: spacing.sm }}>
          <Text variant="display" tone="inverse">Yeni şifre belirleyin</Text>
          <Text tone="inverseMuted">
            {user?.fullName ? `${user.fullName}, h` : 'H'}esabınız geçici bir şifreyle açıldı. Devam etmek için kendi şifrenizi belirleyin.
          </Text>
        </View>

        <View style={styles.card}>
          {errors.form ? (
            <View style={styles.formError} accessibilityRole="alert">
              <Text variant="bodySmall" tone="danger">{errors.form}</Text>
            </View>
          ) : null}
          <Input label="Geçici şifre" icon={KeyRound} value={current} onChangeText={setCurrent} secureTextEntry autoComplete="current-password" textContentType="password" error={errors.current} />
          <Input label="Yeni şifre" icon={Lock} value={next} onChangeText={setNext} secureTextEntry autoComplete="new-password" textContentType="newPassword" error={errors.next} hint="En az 8 karakter, en az bir harf ve bir rakam." />
          <Input label="Yeni şifre (tekrar)" icon={Lock} value={confirm} onChangeText={setConfirm} secureTextEntry autoComplete="new-password" textContentType="newPassword" returnKeyType="go" onSubmitEditing={submit} error={errors.confirm} />
          <Button label="Şifreyi kaydet" size="lg" onPress={submit} loading={loading} fullWidth />
          <Button label="Çıkış yap" variant="ghost" onPress={signOut} fullWidth />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink },
  scroll: { flexGrow: 1, paddingHorizontal: spacing.xl, gap: spacing.xxl, maxWidth: 480, width: '100%', alignSelf: 'center' },
  card: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.xxl, gap: spacing.lg },
  formError: { backgroundColor: colors.dangerSoft, borderRadius: radius.sm, padding: spacing.md },
});
