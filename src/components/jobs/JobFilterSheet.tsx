import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';

import { Button, DateField, SelectField, Sheet, type SelectOption } from '@/components/ui';
import { useAssignableUsers, useCustomers } from '@/hooks/useData';
import { spacing } from '@/theme';
import type { JobFilter } from '@/types';

export type AdvancedFilter = Pick<JobFilter, 'customerId' | 'driverId' | 'dateFrom' | 'dateTo'>;

interface Props {
  visible: boolean;
  value: AdvancedFilter;
  onClose: () => void;
  onApply: (f: AdvancedFilter) => void;
}

const ANY = '__any';

export function JobFilterSheet({ visible, value, onClose, onApply }: Props) {
  const customers = useCustomers();
  const users = useAssignableUsers();
  const [draft, setDraft] = useState<AdvancedFilter>(value);

  useEffect(() => {
    if (visible) setDraft(value);
  }, [visible, value]);

  const customerOptions = useMemo<SelectOption[]>(() => [{ value: ANY, label: 'Tüm müşteriler' }, ...customers.map((c) => ({ value: c.id, label: c.companyName }))], [customers]);
  const driverOptions = useMemo<SelectOption[]>(
    () => [{ value: ANY, label: 'Tüm şoförler' }, ...users.map((u) => ({ value: u.id, label: u.fullName, description: u.role === 'admin' ? 'Yönetici' : 'Şoför' }))],
    [users],
  );

  const dateError = draft.dateFrom && draft.dateTo && draft.dateFrom > draft.dateTo ? 'Bitiş tarihi başlangıçtan önce olamaz.' : undefined;

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Filtrele"
      footer={
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Button label="Temizle" variant="secondary" style={{ flex: 1 }} onPress={() => onApply({})} />
          <Button label="Uygula" style={{ flex: 1 }} disabled={!!dateError} onPress={() => onApply(draft)} />
        </View>
      }>
      <View style={{ paddingHorizontal: spacing.xl, gap: spacing.lg }}>
        <SelectField label="Müşteri" options={customerOptions} value={draft.customerId ?? ANY} onChange={(v) => setDraft((d) => ({ ...d, customerId: v === ANY ? undefined : v }))} searchable />
        <SelectField label="Şoför" options={driverOptions} value={draft.driverId ?? ANY} onChange={(v) => setDraft((d) => ({ ...d, driverId: v === ANY ? undefined : v }))} />
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <View style={{ flex: 1 }}>
            <DateField label="Başlangıç" value={draft.dateFrom} onChange={(v) => setDraft((d) => ({ ...d, dateFrom: v }))} />
          </View>
          <View style={{ flex: 1 }}>
            <DateField label="Bitiş" value={draft.dateTo} onChange={(v) => setDraft((d) => ({ ...d, dateTo: v }))} error={dateError} />
          </View>
        </View>
      </View>
    </Sheet>
  );
}
