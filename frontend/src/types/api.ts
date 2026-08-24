/**
 * Типы ответов API. Написаны вручную по DTO бэкенда
 * (`Application/Dtos/*.cs`) — их немного и они стабильны.
 * При изменении DTO править здесь же.
 */

// ── Перечисления ────────────────────────────────────────────────────────────
// Числовые значения обязаны совпадать с Domain/Enums/Enums.cs:
// System.Text.Json сериализует enum как число, а не как строку.

export const QuestionStatus = {
  Draft: 1,
  Published: 2,
  Archived: 3,
} as const;
export type QuestionStatus = (typeof QuestionStatus)[keyof typeof QuestionStatus];

export const InterviewRound = {
  Screening: 1,
  Technical: 2,
  SystemDesign: 3,
  Final: 4,
} as const;
export type InterviewRound = (typeof InterviewRound)[keyof typeof InterviewRound];

export const UserRole = {
  Editor: 1,
  Admin: 2,
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

/** Сортировка каталога. На бэкенде биндится по имени, поэтому строки. */
export type QuestionSort =
  | "Newest"
  | "Oldest"
  | "Popular"
  | "DifficultyAsc"
  | "DifficultyDesc";

/** Фильтр статуса в админском списке; `All` — только там, это не состояние вопроса. */
export type QuestionStatusFilter = "Draft" | "Published" | "Archived" | "All";

// ── Общее ───────────────────────────────────────────────────────────────────

export interface PagedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasPrevious: boolean;
  hasNext: boolean;
}

/** Минимальная ссылка на справочник. */
export interface Ref {
  id: string;
  slug: string;
  name: string;
  color: string | null;
}

/** Компания в контексте вопроса — с годом и этапом собеседования. */
export interface CompanyRef {
  id: string;
  slug: string;
  name: string;
  logoUrl: string | null;
  color: string | null;
  askedYear: number | null;
  round: InterviewRound | null;
}

// ── Контент ─────────────────────────────────────────────────────────────────

export interface QuestionListItem {
  id: string;
  slug: string;
  title: string;
  difficulty: number;
  status: QuestionStatus;
  viewCount: number;
  isFeatured: boolean;
  answerCount: number;
  createdAt: string;
  category: Ref;
  level: Ref;
  companies: CompanyRef[];
  tags: Ref[];
}

export interface Answer {
  id: string;
  body: string;
  isPrimary: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string | null;
}

export interface QuestionDetail {
  id: string;
  slug: string;
  title: string;
  body: string | null;
  difficulty: number;
  status: QuestionStatus;
  viewCount: number;
  isFeatured: boolean;
  createdAt: string;
  updatedAt: string | null;
  category: Ref;
  level: Ref;
  companies: CompanyRef[];
  tags: Ref[];
  answers: Answer[];
}

// ── Справочники ─────────────────────────────────────────────────────────────

export interface Category {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  /** Имя иконки lucide-react — резолвится динамически, см. components/ui/CategoryIcon. */
  icon: string | null;
  color: string | null;
  sortOrder: number;
  questionCount: number;
}

export interface Level {
  id: string;
  slug: string;
  name: string;
  rank: number;
  color: string | null;
  questionCount: number;
}

export interface Company {
  id: string;
  slug: string;
  name: string;
  logoUrl: string | null;
  color: string | null;
  description: string | null;
  country: string | null;
  sortOrder: number;
  questionCount: number;
}

export interface Tag {
  id: string;
  slug: string;
  name: string;
  questionCount: number;
}

export interface Stats {
  totalQuestions: number;
  totalCompanies: number;
  totalCategories: number;
  byLevel: Level[];
  byCategory: Category[];
}

// ── Аутентификация ──────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  user: AuthUser;
}

// ── Параметры запросов ──────────────────────────────────────────────────────

/** Фильтры каталога. Совпадают с query-параметрами `GET /api/questions`. */
export interface QuestionQueryParams {
  category?: string;
  level?: string;
  company?: string;
  tag?: string;
  q?: string;
  difficulty?: number;
  isFeatured?: boolean;
  sort?: QuestionSort;
  page?: number;
  pageSize?: number;
}

/** То же плюс статус — доступно только админскому списку. */
export interface AdminQuestionQueryParams extends QuestionQueryParams {
  status?: QuestionStatusFilter;
}
