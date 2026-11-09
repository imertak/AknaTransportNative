import { Banknote, FileText, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Button, Chip, DateField, FieldShell, Input, SegmentedControl, Sheet } from '@/components/ui';
import { useAsyncAction } from '@/hooks/useAsyncAction';
import { accountService, PAYMENT_METHODS, type LedgerEntry, type TransactionType } from '@/services/accounts';
import { spacing } from '@/theme';
import { confirm } from '@/utils/confirm';
import { formatCurrency, parseAmount, todayISO } from '@/utils/format';

const TYPE_OPTIONS: { value: TransactionType; label: string }[] = [
  { value: 'Collection', label: 'Gelen' },
  { value: 'Refund', label: 'Giden' },
  { value: 'Charge', label: 'Borç' },
];

const TYPE_HINT =
  'Gelen: müşteriden alınan ödeme, bakiyeyi düşürür. Giden: müşteriye yapılan ödeme veya iade, bakiyeyi artırır. ' +
  'Borç: faturasız borç (devir, açılış bakiyesi vb.), bakiyeyi artırır. Kesilen faturalar bakiyeye kendiliğinden eklenir; onlar için borç kaydı girmeyin.';

interface Props {
  customerId: string;
  /** Düzenlenecek hareket; boşsa yeni kayıt. */
  entry?: LedgerEntry | null;
  /** Yeni kayıtta önerilen tutar (ör. kalan bakiye). */
  suggestedAmount?: number;
  visible: boolean;
  onClose: () => void;
}

/** Tahsilat / iade / borç kaydı ekleme ve düzenleme. Sheet her açılışta yeniden kurulur (key ile). */
export function TransactionSheet(props: Props) {
  if (!props.visible) return null;
  return <TransactionForm key={props.entry?.id ?? 'new'} {...props} />;
}

function TransactionForm({ customerId, entry, suggestedAmount, visible, onClose }: Props) {
  const editing = entry?.transactionId ?? null;
  const [type, setType] = useState<TransactionType>((entry?.kind as TransactionType | undefined) ?? 'Collection');
  const initialAmount = entry ? entry.debit || entry.credit : suggestedAmount && suggestedAmount > 0 ? suggestedAmount : 0;
  const [amount, setAmount] = useState(initialAmount ? String(initialAmount).replace('.', ',') : '');
  const [date, setDate] = useState(entry?.date ?? todayISO());
  const [method, setMethod] = useState<string | null>(entry?.method ?? (entry ? null : 'Havale/EFT'));
  const [description, setDescription] = useState(entry?.description ?? '');
  const [errors, setErrors] = useState<{ amount?: string }>({});
  const { run, pending } = useAsyncAction();

  const submit = async () => {
    const value = parseAmount(amount);
    if (value === null || value <= 0) {
      setErrors({ amount: 'Sıfırdan büyük bir tutar girin.' });
      return;
    }
    setErrors({});
    const input = {
      type,
      amount: Math.round(value * 100) / 100,
      date,
      method: type === 'Charge' ? null : method,
      description: description.trim() || null,
    };
    const ok = await run(
      async () => {
        if (editing) await accountService.updateTransaction(customerId, editing, input);
        else await accountService.addTransaction(customerId, input);
        return true;
      },
      { success: editing ? 'Hareket güncellendi.' : 'Hareket kaydedildi.' },
    );
    if (ok) onClose();
  };

  const remove = async () => {
    if (!editing) return;
    if (!(await confirm({ title: 'Hareketi sil', message: 'Bu kayıt cari hesaptan silinecek.', confirmLabel: 'Sil', destructive: true }))) return;
    const ok = await run(async () => {
      await accountService.deleteTransaction(customerId, editing);
      return true;
    }, { success: 'Hareket silindi.' });
    if (ok) onClose();
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={editing ? 'Hareketi düzenle' : 'Cari hareket ekle'}
      footer={
        <View style={styles.footer}>
          {editing ? <Button label="Sil" variant="danger" icon={Trash2} onPress={remove} disabled={pending} /> : null}
          <View style={{ flex: 1 }}>
            <Button label="Kaydet" onPress={submit} loading={pending} fullWidth />
          </View>
        </View>
      }>
      <ScrollView style={{ flexGrow: 0 }} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <FieldShell label="Hareket türü" hint={TYPE_HINT}>
          <SegmentedControl options={TYPE_OPTIONS} value={type} onChange={setType} />
        </FieldShell>
        <Input
          label="Tutar"
          icon={Banknote}
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          suffix="TL"
          placeholder="0,00"
          error={errors.amount}
          hint={!editing && suggestedAmount && suggestedAmount > 0 ? `Kalan bakiye: ${formatCurrency(suggestedAmount, { decimals: 2 })}` : undefined}
          required
        />
        <DateField label="Tarih" value={date} onChange={setDate} required max={todayISO()} />
        {type !== 'Charge' ? (
          <FieldShell label="Ödeme şekli">
            <View style={styles.chips}>
              {PAYMENT_METHODS.map((m) => (
                <Chip key={m} label={m} active={method === m} onPress={() => setMethod(method === m ? null : m)} />
              ))}
            </View>
          </FieldShell>
        ) : null}
        <Input label="Açıklama" icon={FileText} value={description} onChangeText={setDescription} placeholder="Ör. Ekim faturaları için ödeme" maxLength={500} />
      </ScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: spacing.xl, paddingBottom: spacing.sm, gap: spacing.lg },
  footer: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
});
