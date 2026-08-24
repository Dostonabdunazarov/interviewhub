import { QueryClient } from "@tanstack/react-query";

/**
 * Контент правит один админ и меняется он редко, поэтому staleTime щедрый:
 * переключение между категориями не должно каждый раз бить по сети.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
