import { useCallback, useEffect, useRef, useState } from 'react';

import type { ListPage, ListSummary } from '@/services/contracts';
import { errorMessage } from '@/services/errors';

/** Bir sayfada çekilen kayıt sayısı. */
export const SERVER_PAGE_SIZE = 30;
/** Yenilemede yüklü kayıtlar tek istekte yeniden çekilir; API sayfa boyutu üst sınırı. */
const MAX_PAGE_SIZE = 200;

interface Options<T> {
  /** Filtrenin kimliği: değişince liste ve özet baştan çekilir. */
  key: string;
  fetchPage: (page: number, pageSize: number) => Promise<ListPage<T>>;
  fetchSummary: () => Promise<ListSummary>;
  getId: (item: T) => string;
}

interface ListState<T> {
  /** Bu verinin ait olduğu filtre; mevcut filtreden farklıysa liste yükleniyordur. */
  key: string | null;
  items: T[];
  totalCount: number;
  summary: ListSummary | null;
  error: string | null;
}

/**
 * Sunucudan sayfa sayfa çekilen liste. İlk sayfa ve özet (adet, tutar, ay ay) birlikte istenir; liste sonuna
 * gelince sonraki sayfa eklenir. Filtre değişince eski istekler yok sayılır. `refresh` yüklü kadar kaydı
 * tek istekte yeniler (yüklü sayfalar korunur).
 */
export function useServerList<T>({ key, fetchPage, fetchSummary, getId }: Options<T>) {
  const [state, setState] = useState<ListState<T>>({ key: null, items: [], totalCount: 0, summary: null, error: null });
  const [loadingMore, setLoadingMore] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const request = useRef(0);

  const fetchFirst = useCallback(
    async (pageSize: number) => {
      const id = ++request.current;
      try {
        const [page, summary] = await Promise.all([fetchPage(1, pageSize), fetchSummary()]);
        if (id === request.current) setState({ key, items: page.items, totalCount: page.totalCount, summary, error: null });
      } catch (e) {
        const error = errorMessage(e, 'Liste yüklenemedi.');
        // Yenileme hatasında yüklü liste kalır; yeni filtrede hata olursa eski filtrenin kayıtları gösterilmez.
        if (id === request.current) setState((s) => (s.key === key ? { ...s, error } : { key, items: [], totalCount: 0, summary: null, error }));
      }
    },
    // Getiriciler her çizimde yeniden oluşur; filtre değişimi `key` ile izlenir.
    [key], // eslint-disable-line react-hooks/exhaustive-deps
  );

  useEffect(() => {
    void fetchFirst(SERVER_PAGE_SIZE);
  }, [fetchFirst, attempt]);

  const current = state.key === key;
  const items = current ? state.items : [];
  const totalCount = current ? state.totalCount : 0;

  const loadMore = useCallback(async () => {
    if (!current || loadingMore || items.length >= totalCount) return;
    const id = request.current;
    setLoadingMore(true);
    try {
      // Yenilemeden sonra yüklü sayı sayfa boyutunun katı olmayabilir; çakışan kayıtlar ayıklanır.
      const page = await fetchPage(Math.floor(items.length / SERVER_PAGE_SIZE) + 1, SERVER_PAGE_SIZE);
      if (id !== request.current) return;
      setState((s) => {
        const seen = new Set(s.items.map(getId));
        return { ...s, totalCount: page.totalCount, items: [...s.items, ...page.items.filter((x) => !seen.has(getId(x)))] };
      });
    } catch (e) {
      if (id === request.current) setState((s) => ({ ...s, error: errorMessage(e, 'Liste yüklenemedi.') }));
    } finally {
      setLoadingMore(false);
    }
  }, [current, loadingMore, items.length, totalCount, fetchPage, getId]);

  const refresh = useCallback(
    () => fetchFirst(Math.min(MAX_PAGE_SIZE, Math.max(SERVER_PAGE_SIZE, Math.ceil(items.length / SERVER_PAGE_SIZE) * SERVER_PAGE_SIZE))),
    [fetchFirst, items.length],
  );

  return {
    items,
    totalCount,
    summary: current ? state.summary : null,
    loading: !current,
    loadingMore,
    error: current ? state.error : null,
    loadMore,
    refresh,
    retry: () => setAttempt((a) => a + 1),
  };
}
