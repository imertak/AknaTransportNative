import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { BottomBar, Button, Card, EmptyState, Input, NavHeader, Screen, ScrollContent, Section } from '@/components/ui';
import { useAsyncAction } from '@/hooks/useAsyncAction';
import { useCustomer } from '@/hooks/useData';
import { routes } from '@/navigation/routes';
import { customerActions } from '@/store';
import { spacing } from '@/theme';
import type { CustomerInput } from '@/types';
import { hasErrors, isEmail, isPhone, isTaxNumber, required, type Errors } from '@/utils/validation';

const EMPTY: CustomerInput = { companyName: '', contactName: '', phone: '', email: '', taxOffice: '', taxNumber: '', billingAddress: '', notes: '' };

function validate(f: CustomerInput): Errors<CustomerInput> {
  const e: Errors<CustomerInput> = {};
  if (!required(f.companyName)) e.companyName = 'Firma adını girin.';
  if (!required(f.contactName)) e.contactName = 'Yetkili kişiyi girin.';
  if (!required(f.phone)) e.phone = 'Telefon numarasını girin.';
  else if (!isPhone(f.phone)) e.phone = 'Geçerli bir telefon numarası girin (örn. 0532 000 00 00).';
  if (f.email && !isEmail(f.email)) e.email = 'Geçerli bir e-posta adresi girin.';
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
  const [errors, setErrors] = useState<Errors<CustomerInput>>({});
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

  const set = (key: keyof CustomerInput, value: string) =>
    setForm((f) => {
      const next = { ...f, [key]: value };
      if (submitted.current) setErrors(validate(next));
      return next;
    });

  const submit = async () => {
    submitted.current = true;
    const e = validate(form);
    setErrors(e);
    if (hasErrors(e)) return;
    const input: CustomerInput = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v.trim()])) as CustomerInput;
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
      <ScrollContent keyboard>
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
              hint="Faturalar bu adrese gönderilecek."
            />
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
});
