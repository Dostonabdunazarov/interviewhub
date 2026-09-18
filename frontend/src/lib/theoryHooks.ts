import { useQuery } from "@tanstack/react-query";
import { api } from "./api";
import type { TheoryArticleDetail, TheoryTrackDetail, TheoryTree } from "../types/api";

/**
 * Хуки раздела «Теория». Вынесены из hooks.ts отдельным файлом: теория —
 * самостоятельная подсистема со своим layout, и мешать её в общий файл
 * каталога незачем.
 */
export const theoryKeys = {
  tree: () => ["theory", "tree"] as const,
  track: (slug: string) => ["theory", "track", slug] as const,
  article: (slug: string) => ["theory", "article", slug] as const,
};

/**
 * Дерево теории. Запрашивается на каждой странице раздела, но меняется раз
 * в неделю, поэтому держим его свежим целый час: иначе react-query будет
 * дёргать сеть при каждом переходе между статьями.
 */
const TREE_STALE_MS = 60 * 60 * 1000;

export function useTheoryTree() {
  return useQuery({
    queryKey: theoryKeys.tree(),
    staleTime: TREE_STALE_MS,
    queryFn: async () => (await api.get<TheoryTree>("/theory/tree")).data,
  });
}

export function useTheoryTrack(slug: string | undefined) {
  return useQuery({
    queryKey: theoryKeys.track(slug ?? ""),
    enabled: Boolean(slug),
    staleTime: TREE_STALE_MS,
    queryFn: async () => (await api.get<TheoryTrackDetail>(`/theory/tracks/${slug}`)).data,
  });
}

export function useTheoryArticle(slug: string | undefined) {
  return useQuery({
    queryKey: theoryKeys.article(slug ?? ""),
    enabled: Boolean(slug),
    queryFn: async () => (await api.get<TheoryArticleDetail>(`/theory/articles/${slug}`)).data,
  });
}
