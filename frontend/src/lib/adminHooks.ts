import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiErrorMessage } from "./api";
import { queryKeys } from "./hooks";
import { toast } from "../store/toastStore";
import type {
  AdminQuestionQueryParams,
  Answer,
  Category,
  Company,
  Level,
  PagedResult,
  QuestionDetail,
  QuestionListItem,
  Tag,
  AuthUser,
  TheoryArticleAdmin,
  TheoryArticleListItem,
  TheoryStatus,
  TheorySectionAdmin,
  TheoryTrackAdmin,
} from "../types/api";
import type {
  AnswerInput,
  CategoryInput,
  CompanyInput,
  LevelInput,
  QuestionInput,
  TagInput,
  TheoryArticleInput,
  TheorySectionInput,
  TheoryTrackInput,
  UserCreateInput,
  UserInput,
} from "../types/admin";

export const adminKeys = {
  questions: (params: AdminQuestionQueryParams) => ["admin", "questions", params] as const,
  question: (id: string) => ["admin", "question", id] as const,
  tags: () => ["admin", "tags"] as const,
  users: () => ["admin", "users"] as const,
  theoryTree: () => ["admin", "theory", "tree"] as const,
  theoryArticles: (params: TheoryArticleQueryParams) =>
    ["admin", "theory", "articles", params] as const,
  theoryArticle: (id: string) => ["admin", "theory", "article", id] as const,
};

/** Фильтры админского списка статей. */
export interface TheoryArticleQueryParams {
  sectionId?: string;
  trackId?: string;
  status?: TheoryStatus;
  q?: string;
}

function cleanParams(params: AdminQuestionQueryParams): Record<string, string | number | boolean> {
  return Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ""),
  ) as Record<string, string | number | boolean>;
}

// ── Запросы ─────────────────────────────────────────────────────────────────

/**
 * Список вопросов для админки. `enabled` нужен подбору вопросов в редакторе
 * статьи: пустой поиск не должен уходить на сервер, а pageSize: 0 от этого
 * не спасает — QuestionQuery поднимает его обратно до 20.
 */
export function useAdminQuestions(params: AdminQuestionQueryParams = {}, enabled = true) {
  return useQuery({
    queryKey: adminKeys.questions(params),
    enabled,
    queryFn: async () =>
      (
        await api.get<PagedResult<QuestionListItem>>("/admin/questions", {
          params: cleanParams(params),
        })
      ).data,
  });
}

export function useAdminQuestion(id: string | undefined) {
  return useQuery({
    queryKey: adminKeys.question(id ?? ""),
    enabled: Boolean(id),
    queryFn: async () => (await api.get<QuestionDetail>(`/admin/questions/${id}`)).data,
  });
}

/** В отличие от публичного `/api/tags` отдаёт и теги без вопросов. */
export function useAdminTags() {
  return useQuery({
    queryKey: adminKeys.tags(),
    queryFn: async () => (await api.get<Tag[]>("/admin/tags")).data,
  });
}

export function useUsers() {
  return useQuery({
    queryKey: adminKeys.users(),
    queryFn: async () => (await api.get<AuthUser[]>("/admin/users")).data,
  });
}

// ── Мутации ─────────────────────────────────────────────────────────────────

/**
 * Общая обвязка мутаций: тост об успехе, тост с сообщением бэкенда об ошибке
 * и сброс кэша.
 *
 * Сообщения об ошибках берём как есть: бэкенд отвечает осмысленно
 * («Категория используется в 5 вопросах», «Это последний активный админ»),
 * и заменять это на «Что-то пошло не так» было бы потерей информации.
 */
function useAdminMutation<TArgs, TResult>(
  mutationFn: (args: TArgs) => Promise<TResult>,
  successMessage: string | ((result: TResult) => string),
  invalidate: "content" | "references" | "users" | "theory",
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onSuccess: (result) => {
      toast.success(
        typeof successMessage === "function" ? successMessage(result) : successMessage,
      );

      // Правка контента меняет и счётчики в справочниках, и публичные списки,
      // поэтому проще сбросить всё, чем перечислять затронутые ключи.
      if (invalidate === "users") {
        void queryClient.invalidateQueries({ queryKey: adminKeys.users() });
      } else if (invalidate === "theory") {
        // Публичное дерево бэкенд сбрасывает сам, но react-query держит
        // своё на час — без явного сброса правка не доедет до сайдбара.
        void queryClient.invalidateQueries({ queryKey: ["admin", "theory"] });
        void queryClient.invalidateQueries({ queryKey: ["theory"] });
      } else {
        void queryClient.invalidateQueries({ queryKey: ["admin"] });
        void queryClient.invalidateQueries({ queryKey: queryKeys.categories() });
        void queryClient.invalidateQueries({ queryKey: queryKeys.levels() });
        void queryClient.invalidateQueries({ queryKey: queryKeys.companies() });
        void queryClient.invalidateQueries({ queryKey: queryKeys.tags() });
        void queryClient.invalidateQueries({ queryKey: queryKeys.stats() });
        void queryClient.invalidateQueries({ queryKey: ["questions"] });
      }
    },
    onError: (error) => toast.error(apiErrorMessage(error)),
  });
}

// Вопросы

export function useCreateQuestion() {
  return useAdminMutation(
    async (input: QuestionInput) =>
      (await api.post<QuestionDetail>("/admin/questions", input)).data,
    "Вопрос создан",
    "content",
  );
}

export function useUpdateQuestion() {
  return useAdminMutation(
    async ({ id, input }: { id: string; input: QuestionInput }) =>
      (await api.put<QuestionDetail>(`/admin/questions/${id}`, input)).data,
    "Вопрос сохранён",
    "content",
  );
}

export function useDeleteQuestion() {
  return useAdminMutation(
    async (id: string) => {
      await api.delete(`/admin/questions/${id}`);
    },
    "Вопрос удалён",
    "content",
  );
}

// Ответы

export function useAddAnswer() {
  return useAdminMutation(
    async ({ questionId, input }: { questionId: string; input: AnswerInput }) =>
      (await api.post<Answer>(`/admin/questions/${questionId}/answers`, input)).data,
    "Ответ добавлен",
    "content",
  );
}

export function useUpdateAnswer() {
  return useAdminMutation(
    async ({ id, input }: { id: string; input: AnswerInput }) =>
      (await api.put<Answer>(`/admin/answers/${id}`, input)).data,
    "Ответ сохранён",
    "content",
  );
}

export function useDeleteAnswer() {
  return useAdminMutation(
    async (id: string) => {
      await api.delete(`/admin/answers/${id}`);
    },
    "Ответ удалён",
    "content",
  );
}

// Справочники

export function useCreateCategory() {
  return useAdminMutation(
    async (input: CategoryInput) => (await api.post<Category>("/admin/categories", input)).data,
    "Категория создана",
    "references",
  );
}

export function useUpdateCategory() {
  return useAdminMutation(
    async ({ id, input }: { id: string; input: CategoryInput }) =>
      (await api.put<Category>(`/admin/categories/${id}`, input)).data,
    "Категория сохранена",
    "references",
  );
}

export function useDeleteCategory() {
  return useAdminMutation(
    async (id: string) => {
      await api.delete(`/admin/categories/${id}`);
    },
    "Категория удалена",
    "references",
  );
}

export function useCreateLevel() {
  return useAdminMutation(
    async (input: LevelInput) => (await api.post<Level>("/admin/levels", input)).data,
    "Грейд создан",
    "references",
  );
}

export function useUpdateLevel() {
  return useAdminMutation(
    async ({ id, input }: { id: string; input: LevelInput }) =>
      (await api.put<Level>(`/admin/levels/${id}`, input)).data,
    "Грейд сохранён",
    "references",
  );
}

export function useDeleteLevel() {
  return useAdminMutation(
    async (id: string) => {
      await api.delete(`/admin/levels/${id}`);
    },
    "Грейд удалён",
    "references",
  );
}

export function useCreateCompany() {
  return useAdminMutation(
    async (input: CompanyInput) => (await api.post<Company>("/admin/companies", input)).data,
    "Компания создана",
    "references",
  );
}

export function useUpdateCompany() {
  return useAdminMutation(
    async ({ id, input }: { id: string; input: CompanyInput }) =>
      (await api.put<Company>(`/admin/companies/${id}`, input)).data,
    "Компания сохранена",
    "references",
  );
}

export function useDeleteCompany() {
  return useAdminMutation(
    async (id: string) => {
      await api.delete(`/admin/companies/${id}`);
    },
    "Компания удалена",
    "references",
  );
}

export function useCreateTag() {
  return useAdminMutation(
    async (input: TagInput) => (await api.post<Tag>("/admin/tags", input)).data,
    "Тег создан",
    "references",
  );
}

export function useUpdateTag() {
  return useAdminMutation(
    async ({ id, input }: { id: string; input: TagInput }) =>
      (await api.put<Tag>(`/admin/tags/${id}`, input)).data,
    "Тег сохранён",
    "references",
  );
}

export function useDeleteTag() {
  return useAdminMutation(
    async (id: string) => {
      await api.delete(`/admin/tags/${id}`);
    },
    "Тег удалён",
    "references",
  );
}

// Пользователи

export function useCreateUser() {
  return useAdminMutation(
    async (input: UserCreateInput) => (await api.post<AuthUser>("/admin/users", input)).data,
    "Пользователь создан",
    "users",
  );
}

export function useUpdateUser() {
  return useAdminMutation(
    async ({ id, input }: { id: string; input: UserInput }) =>
      (await api.put<AuthUser>(`/admin/users/${id}`, input)).data,
    "Пользователь сохранён",
    "users",
  );
}

export function useDeleteUser() {
  return useAdminMutation(
    async (id: string) => {
      await api.delete(`/admin/users/${id}`);
    },
    "Пользователь удалён",
    "users",
  );
}

export function useChangePassword() {
  return useAdminMutation(
    async ({ id, newPassword }: { id: string; newPassword: string }) => {
      await api.post(`/admin/users/${id}/password`, { newPassword });
    },
    "Пароль изменён",
    "users",
  );
}

// Теория

/** Дерево для админки: со скрытыми треками и пустыми разделами. */
export function useAdminTheoryTree() {
  return useQuery({
    queryKey: adminKeys.theoryTree(),
    queryFn: async () => (await api.get<TheoryTrackAdmin[]>("/admin/theory/tree")).data,
  });
}

export function useAdminTheoryArticles(params: TheoryArticleQueryParams = {}) {
  return useQuery({
    queryKey: adminKeys.theoryArticles(params),
    queryFn: async () =>
      (
        await api.get<TheoryArticleListItem[]>("/admin/theory/articles", {
          params: Object.fromEntries(
            Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ""),
          ),
        })
      ).data,
  });
}

export function useAdminTheoryArticle(id: string | undefined) {
  return useQuery({
    queryKey: adminKeys.theoryArticle(id ?? ""),
    enabled: Boolean(id),
    queryFn: async () => (await api.get<TheoryArticleAdmin>(`/admin/theory/articles/${id}`)).data,
  });
}

export function useCreateTheoryTrack() {
  return useAdminMutation(
    async (input: TheoryTrackInput) =>
      (await api.post<TheoryTrackAdmin>("/admin/theory/tracks", input)).data,
    "Трек создан",
    "theory",
  );
}

export function useUpdateTheoryTrack() {
  return useAdminMutation(
    async ({ id, input }: { id: string; input: TheoryTrackInput }) =>
      (await api.put<TheoryTrackAdmin>(`/admin/theory/tracks/${id}`, input)).data,
    "Трек сохранён",
    "theory",
  );
}

export function useDeleteTheoryTrack() {
  return useAdminMutation(
    async (id: string) => {
      await api.delete(`/admin/theory/tracks/${id}`);
    },
    "Трек удалён",
    "theory",
  );
}

export function useCreateTheorySection() {
  return useAdminMutation(
    async (input: TheorySectionInput) =>
      (await api.post<TheorySectionAdmin>("/admin/theory/sections", input)).data,
    "Раздел создан",
    "theory",
  );
}

export function useUpdateTheorySection() {
  return useAdminMutation(
    async ({ id, input }: { id: string; input: TheorySectionInput }) =>
      (await api.put<TheorySectionAdmin>(`/admin/theory/sections/${id}`, input)).data,
    "Раздел сохранён",
    "theory",
  );
}

export function useDeleteTheorySection() {
  return useAdminMutation(
    async (id: string) => {
      await api.delete(`/admin/theory/sections/${id}`);
    },
    "Раздел удалён",
    "theory",
  );
}

export function useCreateTheoryArticle() {
  return useAdminMutation(
    async (input: TheoryArticleInput) =>
      (await api.post<TheoryArticleAdmin>("/admin/theory/articles", input)).data,
    "Статья создана",
    "theory",
  );
}

export function useUpdateTheoryArticle() {
  return useAdminMutation(
    async ({ id, input }: { id: string; input: TheoryArticleInput }) =>
      (await api.put<TheoryArticleAdmin>(`/admin/theory/articles/${id}`, input)).data,
    "Статья сохранена",
    "theory",
  );
}

export function useDeleteTheoryArticle() {
  return useAdminMutation(
    async (id: string) => {
      await api.delete(`/admin/theory/articles/${id}`);
    },
    "Статья удалена",
    "theory",
  );
}
