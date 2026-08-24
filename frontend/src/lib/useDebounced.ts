import { useEffect, useState } from "react";

/**
 * Отложенное значение. Нужно поиску: без задержки каждый символ уходил бы
 * отдельным запросом, а полнотекстовый поиск по tsvector — не самая дешёвая
 * операция.
 */
export function useDebounced<T>(value: T, delay = 350): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
