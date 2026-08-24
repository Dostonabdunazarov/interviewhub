import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * Возвращает скролл наверх при смене роута. Браузер сам этого не делает
 * в SPA, поэтому переход с середины каталога открывал бы вопрос,
 * пролистанным до середины.
 */
export function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [pathname]);

  return null;
}
