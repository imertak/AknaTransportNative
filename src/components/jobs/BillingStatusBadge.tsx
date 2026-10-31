import { memo } from 'react';

import { Badge } from '@/components/ui';
import type { JobBillingStatus } from '@/types';

export const BILLING_STATUS_LABEL: Record<JobBillingStatus, string> = {
  not_invoiced: 'Faturalandırılmadı',
  in_draft: 'Taslak faturada',
  invoiced: 'Faturalandırıldı',
};

export const BillingStatusBadge = memo(function BillingStatusBadge({ status }: { status: JobBillingStatus }) {
  return <Badge label={BILLING_STATUS_LABEL[status]} tone={status === 'invoiced' ? 'solid' : status === 'in_draft' ? 'outline' : 'muted'} />;
});
