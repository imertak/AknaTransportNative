import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';

import { accountService, onAccountsChanged, type BalanceOverview, type CustomerLedger } from '@/services/accounts';
import { errorMessage } from '@/services/errors';

interface Remote<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  reload: () => Promise<void>;
}

/** Ekran her öne geldiğinde ve bakiye değiştiğinde sunucudan yeniden çeker. */
function useRemote<T>(load: () => Promise<T>, key: string): Remote<T> {
  const [state, setState] = useState<{ key: string; data: T | null; error: string | null; loading: boolean }>({ key, data: null, error: null, loading: true });

  const reload = useCallback(async () => {
    setState((s) => ({ ...s, loading: true }));
    try {
      const data = await load();
      setState({ key, data, error: null, loading: false });
    } catch (e) {
      setState((s) => ({ ...s, error: errorMessage(e, 'Cari hesap bilgisi alınamadı.'), loading: false }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load, key ile değişir
  }, [key]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );
  useEffect(() => onAccountsChanged(() => void reload()), [reload]);

  const fresh = state.key === key;
  return { data: fresh ? state.data : null, error: fresh ? state.error : null, loading: !fresh || state.loading, reload };
}

export function useBalances(): Remote<BalanceOverview> {
  return useRemote(() => accountService.balances(), 'all');
}

export function useCustomerLedger(customerId: string): Remote<CustomerLedger> {
  return useRemote(() => accountService.ledger(customerId), customerId);
}
