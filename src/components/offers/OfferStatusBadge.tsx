import { memo } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

import { Badge, type BadgeTone } from '@/components/ui';
import type { OfferStatus, TransportType } from '@/types/offers';

export const OFFER_STATUS_LABEL: Record<OfferStatus, string> = {
  Draft: 'Taslak',
  Pending: 'Beklemede',
  Accepted: 'Kabul edildi',
  Rejected: 'Reddedildi',
  Expired: 'Süresi doldu',
  Cancelled: 'İptal',
};

export const TRANSPORT_TYPE_LABEL: Record<TransportType, string> = { Full: 'Komple', Partial: 'Parsiyel' };

const TONE: Record<OfferStatus, BadgeTone> = {
  Draft: 'neutral',
  Pending: 'strong',
  Accepted: 'solid',
  Rejected: 'danger',
  Expired: 'outline',
  Cancelled: 'muted',
};

export const OfferStatusBadge = memo(function OfferStatusBadge({ status, style }: { status: OfferStatus; style?: StyleProp<ViewStyle> }) {
  return <Badge label={OFFER_STATUS_LABEL[status]} tone={TONE[status]} style={style} />;
});
