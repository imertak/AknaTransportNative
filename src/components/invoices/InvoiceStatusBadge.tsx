import { memo } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

import { Badge, type BadgeTone } from '@/components/ui';
import type { Invoice, InvoiceStatus } from '@/types';

export const INVOICE_STATUS_LABEL: Record<InvoiceStatus, string> = {
  demo_draft: 'Taslak',
  demo_created: 'Demo',
  cancelled: 'İptal',
  earsiv_pending: 'e-Arşiv bekliyor',
  earsiv_issued: 'e-Arşiv',
  earsiv_failed: 'e-Arşiv hata',
};

const TONE: Record<InvoiceStatus, BadgeTone> = {
  demo_draft: 'neutral',
  demo_created: 'neutral',
  cancelled: 'muted',
  earsiv_pending: 'strong',
  earsiv_issued: 'solid',
  earsiv_failed: 'danger',
};

export const InvoiceStatusBadge = memo(function InvoiceStatusBadge({ invoice, style }: { invoice: Invoice; style?: StyleProp<ViewStyle> }) {
  // Başka yerde kesilip elle yüklenen fatura e-Arşiv'den gelmez.
  const label = invoice.manual && invoice.status === 'earsiv_issued' ? 'Harici fatura' : INVOICE_STATUS_LABEL[invoice.status];
  return <Badge label={label} tone={TONE[invoice.status]} style={style} />;
});
