import { useMemo, useState } from 'react';

import type { MonthRow } from '@/utils/monthGroups';

/** Bir sayfada gösterilen öğe sayısı. */
export const LIST_PAGE_SIZE = 30;

/**
 * Aylara bölünmüş listeyi sayfa sayfa gösterir: önce ilk sayfa çizilir, liste sonuna gelindikçe (veya
 * "Daha fazla göster" ile) sonraki sayfa eklenir. `resetKey` değişince (filtre, arama) ilk sayfaya dönülür.
 * Ay başlıklarındaki adet ve tutarlar ayın tamamına göredir.
 */
export function usePagedRows<T>(rows: MonthRow<T>[], resetKey: unknown, pageSize = LIST_PAGE_SIZE) {
  const [state, setState] = useState({ key: resetKey, pages: 1 });
  // Filtre değişince ilk sayfaya dön (render sırasında türetilen durum).
  const pages = state.key === resetKey ? state.pages : 1;
  if (state.key !== resetKey) setState({ key: resetKey, pages: 1 });

  const total = useMemo(() => rows.reduce((n, r) => (r.kind === 'item' ? n + 1 : n), 0), [rows]);
  const limit = pages * pageSize;
  const visible = useMemo(() => {
    if (total <= limit) return rows;
    const out: MonthRow<T>[] = [];
    let items = 0;
    for (const row of rows) {
      if (row.kind === 'item') {
        if (items >= limit) break;
        items++;
      } else if (items >= limit) break;
      out.push(row);
    }
    return out;
  }, [rows, total, limit]);

  const shown = Math.min(total, limit);
  const hasMore = shown < total;
  const loadMore = () => {
    if (hasMore) setState({ key: resetKey, pages: pages + 1 });
  };
  return { rows: visible, shown, total, hasMore, loadMore };
}
