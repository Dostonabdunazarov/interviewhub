import { useQuery } from "@tanstack/react-query";
import { api } from "./api";
import type {
  Category,
  Company,
  Level,
  PagedResult,
  QuestionDetail,
  QuestionListItem,
  QuestionQueryParams,
  Stats,
  Tag,
} from "../types/api";

/**
 * Хуки публичного API. Ключи собраны в одном месте, чтобы инвалидация
 * из админки (шаг 9) не гадала, как назывался запрос.
 */
export const queryKeys = {
  questions: (params: QuestionQueryParams) => ["questions", params] as const,
  question: (slug: string) => ["question", slug] as const,
  categories: () => ["categories"] as const,
  levels: () => ["levels"] as const,
  companies: () => ["companies"] as const,
  company: (slug: string) => ["company", slug] as const,
  tags: () => ["tags"] as const,
  stats: () => ["stats"] as const,
};

/**
 * Пустые значения выкидываем из query: иначе в URL уедет `?category=`,
 * и ссылка на каталог перестанет быть чистой.
 */
function cleanParams(params: QuestionQueryParams): Record<string, string | number | boolean> {
  return Object.fromEntries(
    Object.entries(params).filter(
      ([, value]) => value !== undefined && value !== null && value !== "",
    ),
  ) as Record<string, string | number | boolean>;
}

export function useQuestions(params: QuestionQueryParams = {}) {
  return useQuery({
    queryKey: queryKeys.questions(params),
    queryFn: async () => {
      const { data } = await api.get<PagedResult<QuestionListItem>>("/questions", {
        params: cleanParams(params),
      });
      return data;
    },
  });
}

export function useQuestion(slug: string | undefined) {
  return useQuery({
    queryKey: queryKeys.question(slug ?? ""),
    enabled: Boolean(slug),
    queryFn: async () => {
      const { data } = await api.get<QuestionDetail>(`/questions/${slug}`);
      return data;
    },
  });
}

export function useCategories() {
  return useQuery({
    queryKey: queryKeys.categories(),
    queryFn: async () => (await api.get<Category[]>("/categories")).data,
  });
}

export function useLevels() {
  return useQuery({
    queryKey: queryKeys.levels(),
    queryFn: async () => (await api.get<Level[]>("/levels")).data,
  });
}

export function useCompanies() {
  return useQuery({
    queryKey: queryKeys.companies(),
    queryFn: async () => (await api.get<Company[]>("/companies")).data,
  });
}

export function useCompany(slug: string | undefined) {
  return useQuery({
    queryKey: queryKeys.company(slug ?? ""),
    enabled: Boolean(slug),
    queryFn: async () => (await api.get<Company>(`/companies/${slug}`)).data,
  });
}

export function useTags() {
  return useQuery({
    queryKey: queryKeys.tags(),
    queryFn: async () => (await api.get<Tag[]>("/tags")).data,
  });
}

export function useStats() {
  return useQuery({
    queryKey: queryKeys.stats(),
    queryFn: async () => (await api.get<Stats>("/stats")).data,
  });
}
