import type { MapStop } from '@/components/map/types';
import type { TransportJob } from '@/types';
import { orderStops } from './stops';

/** Yükleme tamamlanınca (teslimata çıkıldı) yükleme noktaları geçilmiş sayılır. */
const pickupsDone = (job: TransportJob) => job.status === 'delivering' || job.status === 'completed';

/**
 * İşin konumu bilinen durakları güzergâh sırasıyla (önce yüklemeler, sonra teslimatlar) harita
 * işaretçisine çevirir. Koordinatı olmayan adres haritaya konmaz.
 */
export function jobMapStops(job: TransportJob): MapStop[] {
  const out: MapStop[] = [];
  if (job.stops.length > 0) {
    orderStops(job.stops).forEach((stop, i) => {
      if (!stop.point) return;
      out.push({
        id: `${job.id}_${stop.type}_${stop.sequence}`,
        kind: stop.type,
        order: i + 1,
        coordinate: stop.point,
        title: `${stop.type === 'pickup' ? 'Yükleme' : 'Teslimat'} ${stop.sequence}`,
        subtitle: stop.address,
        done: (stop.type === 'pickup' && pickupsDone(job)) || job.status === 'completed',
      });
    });
    return out;
  }
  if (job.pickupPoint) out.push({ id: `${job.id}_pickup`, kind: 'pickup', order: 1, coordinate: job.pickupPoint, title: 'Yükleme', subtitle: job.pickupAddress, done: pickupsDone(job) });
  if (job.deliveryPoint) out.push({ id: `${job.id}_delivery`, kind: 'delivery', order: out.length + 1, coordinate: job.deliveryPoint, title: 'Teslimat', subtitle: job.deliveryAddress });
  return out;
}
