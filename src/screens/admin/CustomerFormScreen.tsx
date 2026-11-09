import { router, useLocalSearchParams } from 'expo-router';
import { Plus, X } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { BottomBar, Button, Card, EmptyState, Input, NavHeader, Screen, ScrollContent, Section, Text } from '@/components/ui';
import { useAsyncAction } from '@/hooks/useAsyncAction';
import { useCustomer } from '@/hooks/useData';
import { routes } from '@/navigation/routes';
import { customerActions } from '@/store';
import { colors, hitSlop, spacing } from '@/theme';
import type { CustomerInput } from '@/types';
import { hasErrors, isEmail, isPhone, isTaxNumber, required, type Errors } from '@/utils/validation';

const EMPTY: CustomerInput = { companyName: '', contactName: '', phone: '', email: '', extraEmails: [], taxOffice: '', taxNumber: '', billingAddress: '', notes: '' };
/** Sunucudaki üst sınırla aynı (ana adres dahil). */
const MAX_EMAILS = 10;

type FormErrors = Omit<Errors<CustomerInput>, 'extraEmails'> & { extraEmails?: Record<number, string> };

function validate(f: CustomerInput): FormErrors {
  const e: FormErrors = {};
  if (!required(f.companyName)) e.companyName = 'Firma adını girin.';
  if (!required(f.contactName)) e.contactName = 'Yetkili kişiyi girin.';
  if (!required(f.phone)) e.phone = 'Telefon numarasını girin.';
  else if (!isPhone(f.phone)) e.phone = 'Geçerli bir telefon numarası girin (örn. 0532 000 00 00).';
  if (f.email && !isEmail(f.email)) e.email = 'Geçerli bir e-posta adresi girin.';
  const extra: Record<number, string> = {};
  const seen = new Set([f.email.trim().toLowerCase()]);
  f.extraEmails.forEach((m, i) => {
    const v = m.trim().toLowerCase();
    if (!v) return;
    if (!isEmail(v)) extra[i] = 'Geçerli bir e-posta adresi girin.';
    else if (seen.has(v)) extra[i] = 'Bu adres zaten ekli.';
    seen.add(v);
  });
  if (Object.keys(extra).length) e.extraEmails = extra;
  if (!f.email.trim() && f.extraEmails.some((m) => m.trim())) e.email = 'Önce ana e-posta adresini girin.';
  if (f.taxNumber && !isTaxNumber(f.taxNumber)) e.taxNumber = 'Vergi no 10, TC kimlik no 11 haneli olmalıdır.';
  return e;
}

export default function CustomerFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const existing = useCustomer(id);
  const isEdit = !!id;
  const { run, pending } = useAsyncAction();
  const [form, setForm] = useState<CustomerInput>(() => {
    if (!existing) return EMPTY;
    const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = existing;
    return rest;
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const submitted = useRef(false);

  if (isEdit && !existing) {
    return (
      <Screen>
        <NavHeader title="Müşteriyi düzenle" />
        <View style={{ padding: spacing.lg }}>
          <EmptyState title="Müşteri bulunamadı" />
        </View>
      </Screen>
    );
  }

  const update = (fn: (f: CustomerInput) => CustomerInput) =>
    setForm((f) => {
      const next = fn(f);
      if (submitted.current) setErrors(validate(next));
      return next;
    });
  const set = (key: Exclude<keyof CustomerInput, 'extraEmails'>, value: string) => update((f) => ({ ...f, [key]: value }));
  const setExtra = (index: number, value: string) => update((f) => ({ ...f, extraEmails: f.extraEmails.map((m, i) => (i === index ? value : m)) }));
  const addExtra = () => update((f) => ({ ...f, extraEmails: [...f.extraEmails, ''] }));
  const removeExtra = (index: number) => update((f) => ({ ...f, extraEmails: f.extraEmails.filter((_, i) => i !== index) }));

  const submit = async () => {
    submitted.current = true;
    const e = validate(form);
    setErrors(e);
    const { extraEmails: extraErrors, ...fieldErrors } = e;
    if (hasErrors(fieldErrors) || extraErrors) return;
    const input: CustomerInput = {
      ...(Object.fromEntries(Object.entries(form).filter(([k]) => k !== 'extraEmails').map(([k, v]) => [k, String(v).trim()])) as Omit<CustomerInput, 'extraEmails'>),
      extraEmails: form.extraEmails.map((m) => m.trim()).filter(Boolean),
    };
    input.taxNumber = input.taxNumber.replace(/\s/g, '');
    const saved = await run(() => (isEdit ? customerActions.update(id!, input) : customerActions.create(input)), {
      success: isEdit ? 'Müşteri güncellendi.' : 'Müşteri kaydedildi.',
    });
    if (saved) {
      if (isEdit) router.back();
      else router.replace(routes.customer(saved.id));
    }
  };

  return (
    <Screen>
      <NavHeader title={isEdit ? 'Müşteriyi düzenle' : 'Yeni müşteri'} subtitle={existing?.companyName} />
      <ScrollContent>
        <Section title="Firma">
          <Card style={styles.card}>
            <Input label="Firma adı" required value={form.companyName} onChangeText={(v) => set('companyName', v)} error={errors.companyName} placeholder="Örn. Starbucks" />
            <Input label="Yetkili kişi" required value={form.contactName} onChangeText={(v) => set('contactName', v)} error={errors.contactName} placeholder="Ad soyad veya birim" />
            <Input label="Telefon" required keyboardType="phone-pad" value={form.phone} onChangeText={(v) => set('phone', v)} error={errors.phone} placeholder="0532 000 00 00" />
            <Input
              label="E-posta"
              keyboardType="email-address"
              autoCapitalize="none"
              value={form.email}
              onChangeText={(v) => set('email', v)}
              error={errors.email}
              placeholder="muhasebe@firma.com"
              hint={form.extraEmails.length ? 'Ana adres. Faturalar bu adrese, diğer adreslere bilgi (CC) olarak gönderilir.' : 'Faturalar bu adrese gönderilecek.'}
            />
            {form.extraEmails.map((m, i) => (
              <View key={i} style={styles.extraRow}>
                <View style={{ flex: 1 }}>
                  <Input
                    keyboardType="email-address"
                    autoCapitalize="none"
                    value={m}
                    onChangeText={(v) => setExtra(i, v)}
                    error={errors.extraEmails?.[i]}
                    placeholder="satinalma@firma.com"
                    accessibilityLabel={`${i + 2}. e-posta`}
                  />
                </View>
                <Pressable onPress={() => removeExtra(i)} hitSlop={hitSlop} style={styles.remove} accessibilityRole="button" accessibilityLabel={`${i + 2}. e-postayı kaldır`}>
                  <X size={18} color={colors.textTertiary} />
                </Pressable>
              </View>
            ))}
            {form.extraEmails.length + 1 < MAX_EMAILS ? (
              <Pressable onPress={addExtra} hitSlop={hitSlop} style={styles.addLink} accessibilityRole="button">
                <Plus size={16} color={colors.text} />
                <Text variant="label">E-posta ekle</Text>
              </Pressable>
            ) : null}
          </Card>
        </Section>
        <Section title="Fatura bilgileri">
          <Card style={styles.card}>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Input label="Vergi dairesi" value={form.taxOffice} onChangeText={(v) => set('taxOffice', v)} placeholder="Örn. Kadıköy" />
              </View>
              <View style={{ flex: 1 }}>
                <Input label="Vergi no" keyboardType="number-pad" maxLength={11} value={form.taxNumber} onChangeText={(v) => set('taxNumber', v.replace(/\D/g, ''))} error={errors.taxNumber} placeholder="10 hane" />
              </View>
            </View>
            <Input label="Fatura adresi" multiline value={form.billingAddress} onChangeText={(v) => set('billingAddress', v)} placeholder="Açık adres" />
            <Input label="Açıklama" multiline value={form.notes} onChangeText={(v) => set('notes', v)} placeholder="Müşteriye özel notlar" />
          </Card>
        </Section>
      </ScrollContent>
      <BottomBar>
        <Button label="Vazgeç" variant="secondary" onPress={() => router.back()} style={{ flex: 1 }} />
        <Button label={isEdit ? 'Kaydet' : 'Müşteriyi kaydet'} onPress={submit} loading={pending} style={{ flex: 2 }} />
      </BottomBar>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.lg },
  row: { flexDirection: 'row', gap: spacing.sm },
  extraRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  remove: { padding: spacing.xs, marginTop: 12 },
  addLink: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
});
