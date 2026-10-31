import { useCallback, useRef, useState } from 'react';

import { useToast } from '@/contexts/ToastContext';
import { errorMessage } from '@/services/errors';

/**
 * Bir async işlemi çalıştırır; yükleniyor durumunu, çift dokunmayı ve
 * hata/başarı bildirimlerini tek noktadan yönetir.
 */
export function useAsyncAction() {
  const toast = useToast();
  const [pending, setPending] = useState(false);
  const running = useRef(false);

  const run = useCallback(
    async <T,>(fn: () => Promise<T>, opts: { success?: string; error?: string } = {}): Promise<T | undefined> => {
      if (running.current) return undefined;
      running.current = true;
      setPending(true);
      try {
        const result = await fn();
        if (opts.success) toast.show(opts.success, 'success');
        return result;
      } catch (e) {
        toast.show(errorMessage(e, opts.error), 'error');
        return undefined;
      } finally {
        running.current = false;
        setPending(false);
      }
    },
    [toast],
  );

  return { run, pending };
}
