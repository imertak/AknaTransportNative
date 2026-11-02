import { Link } from 'expo-router';
import { Eye, EyeOff, Lock, Mail, type LucideIcon } from 'lucide-react-native';
import { useRef, useState, type ComponentRef, type ReactNode, type Ref } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { BrandMark } from '@/components/BrandMark';
import { Button, Text } from '@/components/ui';
import { APP_CONFIG } from '@/constants/config';
import { useAuth } from '@/contexts/AuthContext';
import { errorMessage } from '@/services/errors';
import { colors, hitSlop, radius, spacing } from '@/theme';
import { isEmail } from '@/utils/validation';

/** Koyu zemin üzerinde okunabilir hata rengi (tema kırmızısı siyah üstünde fazla koyu kalıyor). */
const ERROR_ON_DARK = '#FF8A80';

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
      <Glow />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + spacing.huge, paddingBottom: insets.bottom + spacing.xl }]}
        keyboardShouldPersistTaps="handled">
        <View style={styles.brand}>
          <BrandMark size="md" />
        </View>

        <View style={styles.form}>
          <View style={styles.heading}>
            <Text style={styles.title}>Tekrar hoş geldiniz</Text>
            <Text variant="body" tone="inverseMuted">Hesabınıza giriş yapın.</Text>
          </View>

          {errors.form ? (
            <View style={styles.formError} accessibilityRole="alert">
              <Text variant="bodySmall" style={{ color: ERROR_ON_DARK }}>{errors.form}</Text>
            </View>
          ) : null}

          <PillInput
            icon={Mail}
            accessibilityLabel="E-posta"
            value={email}
            onChangeText={(v) => {
              setEmail(v);
              if (errors.email || errors.form) setErrors((e) => ({ ...e, email: undefined, form: undefined }));
            }}
            placeholder="E-posta adresi"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="username"
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
            error={errors.email}
          />
          <PillInput
            ref={passwordRef}
            icon={Lock}
            accessibilityLabel="Şifre"
            value={password}
            onChangeText={(v) => {
              setPassword(v);
              if (errors.password || errors.form) setErrors((e) => ({ ...e, password: undefined, form: undefined }));
            }}
            placeholder="Şifre"
            secureTextEntry={!showPassword}
            autoComplete="password"
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={submit}
            error={errors.password}
            right={
              <Pressable onPress={() => setShowPassword((s) => !s)} hitSlop={hitSlop} accessibilityLabel={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}>
                {showPassword ? <EyeOff size={20} color={colors.textInverseMuted} /> : <Eye size={20} color={colors.textInverseMuted} />}
              </Pressable>
            }
          />

          <Link href="/forgot-password" asChild>
            <Pressable hitSlop={hitSlop} style={styles.forgot} accessibilityRole="link">
              <Text variant="label" tone="inverse">Şifremi unuttum</Text>
            </Pressable>
          </Link>

          <Button label="Giriş yap" variant="inverse" size="lg" onPress={submit} loading={loading} fullWidth style={styles.submit} />
        </View>

        {!APP_CONFIG.apiBaseUrl ? (
          <View style={styles.config} accessibilityRole="alert">
            <Text variant="label" tone="inverse">API adresi yapılandırılmadı</Text>
            <Text variant="bodySmall" tone="inverseMuted">
              Proje kökündeki .env.local dosyasına EXPO_PUBLIC_API_BASE_URL=http://&lt;sunucu-IP&gt;:5080 yazıp uygulamayı yeniden başlatın.
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** Sol üst köşedeki hafif beyaz ışıma. Ek paket gerektirmemek için react-native-svg ile çizilir. */
function Glow() {
  return (
    <View pointerEvents="none" style={styles.glow}>
      <Svg width="100%" height="100%">
        <Defs>
          <RadialGradient id="loginGlow" cx="0%" cy="0%" r="100%" fx="0%" fy="0%">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.16} />
            <Stop offset="0.45" stopColor="#FFFFFF" stopOpacity={0.05} />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#loginGlow)" />
      </Svg>
    </View>
  );
}

type PillInputProps = TextInputProps & { icon: LucideIcon; right?: ReactNode; error?: string; ref?: Ref<ComponentRef<typeof TextInput>> };

/** Giriş ekranına özel, koyu zeminli yuvarlak (hap) giriş alanı. */
function PillInput({ icon: Icon, right, error, onFocus, onBlur, ref, ...rest }: PillInputProps) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: spacing.xs }}>
      <View style={[styles.pill, focused && styles.pillFocused, !!error && styles.pillError]}>
        <View style={styles.pillIcon}>
          <Icon size={20} color={focused ? colors.textInverse : colors.textInverseMuted} />
        </View>
        <TextInput
          ref={ref}
          {...rest}
          style={styles.pillText}
          placeholderTextColor={colors.inkMuted}
          selectionColor={colors.textInverse}
          cursorColor={colors.textInverse}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
        />
        {right}
      </View>
      {error ? (
        <Text variant="bodySmall" style={[styles.fieldError, { color: ERROR_ON_DARK }]}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink },
  glow: { position: 'absolute', top: 0, left: 0, width: 520, height: 520 },
  scroll: { flexGrow: 1, paddingHorizontal: spacing.xxl, gap: spacing.huge, justifyContent: 'center', maxWidth: 480, width: '100%', alignSelf: 'center' },
  brand: { alignItems: 'flex-start' },
  form: { gap: spacing.lg },
  heading: { gap: spacing.sm, marginBottom: spacing.md },
  title: { color: colors.textInverse, fontSize: 34, lineHeight: 42, fontWeight: '700', letterSpacing: -0.8 },
  formError: { backgroundColor: 'rgba(211, 47, 47, 0.14)', borderWidth: 1, borderColor: 'rgba(211, 47, 47, 0.45)', borderRadius: radius.md, padding: spacing.md },
  pill: {
    height: 58,
    borderRadius: radius.pill,
    backgroundColor: '#161616',
    borderWidth: 1,
    borderColor: colors.inkLine,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  pillIcon: { flexShrink: 0 },
  pillFocused: { borderColor: '#555555' },
  pillError: { borderColor: 'rgba(255, 138, 128, 0.6)' },
  pillText: { flex: 1, height: '100%', color: colors.textInverse, fontSize: 16, ...(Platform.OS === 'web' ? { outlineStyle: 'none' as never } : null) },
  fieldError: { paddingHorizontal: spacing.xl },
  forgot: { alignSelf: 'flex-end' },
  submit: { borderRadius: radius.pill, marginTop: spacing.sm, height: 58 },
  config: { gap: spacing.xs, borderWidth: 1, borderColor: colors.inkLine, backgroundColor: colors.inkRaised, borderRadius: radius.md, padding: spacing.md },
});
