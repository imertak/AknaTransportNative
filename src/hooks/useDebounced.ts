import { useEffect, useState } from 'react';

/** Değer `delay` ms boyunca değişmeyince güncellenir (yazarken her harfte istek atılmasın diye). */
export function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}
