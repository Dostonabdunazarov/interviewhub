import { useQuery } from "@tanstack/react-query";
import { api } from "./api";
import type { PrepGuideDetail, PrepGuideListItem } from "../types/api";

export const prepKeys = {
  guides: () => ["prep"] as const,
  guide: (slug: string) => ["prep", slug] as const,
};

export function usePrepGuides() {
  return useQuery({
    queryKey: prepKeys.guides(),
    queryFn: async () => (await api.get<PrepGuideListItem[]>("/prep")).data,
  });
}

export function usePrepGuide(slug: string | undefined) {
  return useQuery({
    queryKey: prepKeys.guide(slug ?? ""),
    enabled: Boolean(slug),
    queryFn: async () => (await api.get<PrepGuideDetail>(`/prep/${slug}`)).data,
  });
}

function progressKey(guideSlug: string) {
  return `prep-progress:${guideSlug}`;
}

export function readPrepProgress(guideSlug: string): string[] {
  try {
    const raw = localStorage.getItem(progressKey(guideSlug));
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter((s): s is string => typeof s === "string")
      : [];
  } catch {
    return [];
  }
}

export function writePrepProgress(guideSlug: string, slugs: string[]) {
  try {
    if (slugs.length === 0) localStorage.removeItem(progressKey(guideSlug));
    else localStorage.setItem(progressKey(guideSlug), JSON.stringify(slugs));
  } catch {
    return;
  }
}
