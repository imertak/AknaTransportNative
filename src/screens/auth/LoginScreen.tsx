import { Link } from 'expo-router';
import { Eye, EyeOff, Lock, Mail } from 'lucide-react-native';
import { useRef, useState, type ComponentRef } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BrandMark } from '@/components/BrandMark';
import { Button, Input, Text } from '@/components/ui';
import { APP_CONFIG } from '@/constants/config';
import { useAuth } from '@/contexts/AuthContext';
import { errorMessage } from '@/services/errors';
import { colors, hitSlop, radius, spacing } from '@/theme';
import { isEmail } from '@/utils/validation';

const DEMO_ACCOUNTS = [
  { label: 'Yönetici', email: 'admin@akna.com' },
  { label: 'Şoför', email: 'driver@akna.com' },
];

export default function LoginScreen() {
  const { signIn } = useAuth();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({});
  const [loading, setLoading] = useState(false);
  const passwordRef = useRef<ComponentRef<typeof TextInput>>(null);

  const submit = async () => {
    const next: typeof errors = {};
    if (!email.trim()) next.email = 'E-posta adresinizi girin.';
    else if (!isEmail(email)) next.email = 'Geçerli bir e-posta adresi girin.';
    if (!password) next.password = 'Şifrenizi girin.';
    setErrors(next);
    if (next.email || next.password) return;
    setLoading(true);
    try {
      await signIn(email, password);
    } catch (e) {
      setErrors({ form: errorMessage(e, 'Giriş yapılamadı.') });
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + spacing.huge, paddingBottom: insets.bottom + spacing.xl }]} keyboardShouldPersistTaps="handled">
        <View style={styles.brand}>
          <BrandMark />
          <Text variant="bodySmall" tone="inverseMuted" align="center">Nakliye operasyon yönetimi</Text>
        </View>

        <View style={styles.card}>
          <View style={{ gap: spacing.xs }}>
            <Text variant="title">Giriş yap</Text>
            <Text variant="bodySmall" tone="secondary">Hesabınızla oturum açın.</Text>
          </View>

          {errors.form ? (
            <View style={styles.formError} accessibilityRole="alert">
              <Text variant="bodySmall" tone="danger">{errors.form}</Text>
            </View>
          ) : null}

          <Input
            label="E-posta"
            icon={Mail}
            value={email}
            onChangeText={(v) => {
              setEmail(v);
              if (errors.email || errors.form) setErrors((e) => ({ ...e, email: undefined, form: undefined }));
            }}
            placeholder="ornek@akna.com"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="username"
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
            error={errors.email}
          />
          <Input
            ref={passwordRef}
            label="Şifre"
            icon={Lock}
            value={password}
            onChangeText={(v) => {
              setPassword(v);
              if (errors.password || errors.form) setErrors((e) => ({ ...e, password: undefined, form: undefined }));
            }}
            placeholder="Şifreniz"
            secureTextEntry={!showPassword}
            autoComplete="password"
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={submit}
            error={errors.password}
            right={
              <Pressable onPress={() => setShowPassword((s) => !s)} hitSlop={hitSlop} accessibilityLabel={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}>
                {showPassword ? <EyeOff size={18} color={colors.textTertiary} /> : <Eye size={18} color={colors.textTertiary} />}
              </Pressable>
            }
          />

          <Link href="/forgot-password" asChild>
            <Pressable hitSlop={hitSlop} style={styles.forgot} accessibilityRole="link">
              <Text variant="label">Şifremi unuttum</Text>
            </Pressable>
          </Link>

          <Button label="Giriş yap" size="lg" onPress={submit} loading={loading} fullWidth />
        </View>

        {APP_CONFIG.dataSource === 'mock' ? (
          <View style={styles.demo}>
            <Text variant="caption" tone="inverseMuted" align="center">Demo hesaplar · şifre 123456</Text>
            <View style={styles.demoRow}>
              {DEMO_ACCOUNTS.map((a) => (
                <Pressable
                  key={a.email}
                  onPress={() => {
                    setEmail(a.email);
                    setPassword('123456');
                    setErrors({});
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`${a.label} demo hesabını doldur`}
                  style={({ pressed }) => [styles.demoChip, pressed && { opacity: 0.7 }]}>
                  <Text variant="label" tone="inverse">{a.label}</Text>
                  <Text variant="bodySmall" tone="inverseMuted">{a.email}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink },
  scroll: { flexGrow: 1, paddingHorizontal: spacing.xl, gap: spacing.xxxl, justifyContent: 'center', maxWidth: 480, width: '100%', alignSelf: 'center' },
  brand: { alignItems: 'center', gap: spacing.md },
  card: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.xxl, gap: spacing.lg },
  formError: { backgroundColor: colors.dangerSoft, borderRadius: radius.sm, padding: spacing.md },
  forgot: { alignSelf: 'flex-end', marginTop: -spacing.xs },
  demo: { gap: spacing.md },
  demoRow: { flexDirection: 'row', gap: spacing.sm },
  demoChip: { flex: 1, borderWidth: 1, borderColor: colors.inkLine, backgroundColor: colors.inkRaised, borderRadius: radius.md, padding: spacing.md, gap: 2 },
});
