import { memo } from 'react';

import { JOB_STATUS_LABEL } from '@/constants/jobStatus';
import type { JobStatus } from '@/types';
import { Badge, type BadgeTone } from './Badge';

/** Durumlar renk yerine gri ton yoğunluğu ve dolgu ile ayrışır. */
const TONE: Record<JobStatus, BadgeTone> = {
  pending: 'neutral',
  assigned: 'strong',
  accepted: 'strong',
  on_the_way: 'solid',
  loading: 'solid',
  delivering: 'solid',
  completed: 'outline',
  cancelled: 'muted',
};

export const StatusBadge = memo(function StatusBadge({ status }: { status: JobStatus }) {
  const tone = TONE[status];
  return <Badge label={JOB_STATUS_LABEL[status]} tone={tone} dot={tone === 'solid'} />;
});
