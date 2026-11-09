import { useEffect, useRef } from 'react';

/**
 * Sunucudan sayfalı çekilen listeyi uygulama verisiyle senkron tutar: kayıt eklenip silindiğinde (adet
 * değişince) liste sessizce yenilenir. İlk çizimde çalışmaz.
 */
export function useRefreshOnCountChange(count: number, ready: boolean, refresh: () => unknown) {
  const last = useRef<number | null>(null);
  useEffect(() => {
    if (!ready) return;
    if (last.current !== null && last.current !== count) void refresh();
    last.current = count;
  }, [count, ready]); // eslint-disable-line react-hooks/exhaustive-deps
}
