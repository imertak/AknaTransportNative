import { useCallback, useState } from 'react';

import { refreshAll } from '@/store';

/** Aşağı çekerek yenileme. Servislerden tüm veriyi tek istekle tazeler. */
export function useRefresh() {
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshAll();
    } finally {
      setRefreshing(false);
    }
  }, []);
  return { refreshing, onRefresh };
}
