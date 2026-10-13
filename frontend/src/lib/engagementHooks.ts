import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "./api";
import type { Fact, PagedResult, PuzzleDetail, PuzzleListItem, PuzzleQueryParams } from "../types/api";
import type { SuggestionInput } from "../types/admin";

export const engagementKeys = {
  puzzles: (params: PuzzleQueryParams) => ["puzzles", params] as const,
  puzzle: (slug: string) => ["puzzle", slug] as const,
  facts: (category?: string) => ["facts", category ?? ""] as const,
};

function cleanParams(params: object): Record<string, string | number> {
  return Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ""),
  ) as Record<string, string | number>;
}

export function usePuzzles(params: PuzzleQueryParams = {}) {
  return useQuery({
    queryKey: engagementKeys.puzzles(params),
    queryFn: async () =>
      (await api.get<PagedResult<PuzzleListItem>>("/puzzles", { params: cleanParams(params) })).data,
  });
}

export function usePuzzle(slug: string | undefined) {
  return useQuery({
    queryKey: engagementKeys.puzzle(slug ?? ""),
    enabled: Boolean(slug),
    queryFn: async () => (await api.get<PuzzleDetail>(`/puzzles/${slug}`)).data,
  });
}

export function useFacts(category?: string) {
  return useQuery({
    queryKey: engagementKeys.facts(category),
    queryFn: async () =>
      (await api.get<Fact[]>("/facts", { params: cleanParams({ category }) })).data,
  });
}

export function useSubmitSuggestion() {
  return useMutation({
    mutationFn: async (input: SuggestionInput) => {
      await api.post("/suggestions", input);
    },
  });
}

const SOLVED_KEY = "ih.puzzles.solved";

export type SolvedMap = Record<string, boolean>;

export function readSolved(): SolvedMap {
  try {
    const raw = localStorage.getItem(SOLVED_KEY);
    return raw ? (JSON.parse(raw) as SolvedMap) : {};
  } catch {
    return {};
  }
}

export function markSolved(slug: string, correct: boolean) {
  try {
    const map = readSolved();
    if (map[slug] === true) return;
    map[slug] = correct;
    localStorage.setItem(SOLVED_KEY, JSON.stringify(map));
  } catch {
    return;
  }
}
