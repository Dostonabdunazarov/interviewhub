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
  /** Статьи теории, к которым привязан вопрос — блок «Теория по теме». */
  theoryArticles: TheoryArticleRef[];
}

/** Ссылка на статью теории со страницы вопроса. */
export interface TheoryArticleRef {
  slug: string;
  title: string;
  readingMinutes: number;
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

// ── Теория ──────────────────────────────────────────────────────────

/** Статус статьи. Совпадает с TheoryStatus в Domain/Enums/Enums.cs. */
export const TheoryStatus = {
  Draft: 1,
  Published: 2,
  Archived: 3,
} as const;
export type TheoryStatus = (typeof TheoryStatus)[keyof typeof TheoryStatus];

/** Статья в дереве — без тела: в сайдбаре нужен только заголовок. */
export interface TheoryArticleNode {
  slug: string;
  title: string;
  summary: string | null;
  readingMinutes: number;
  level: Ref | null;
}

export interface TheorySectionNode {
  slug: string;
  name: string;
  description: string | null;
  articleCount: number;
  articles: TheoryArticleNode[];
}

export interface TheoryTrackNode {
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  articleCount: number;
  sections: TheorySectionNode[];
}

/** Всё дерево теории одним ответом — один запрос на весь сайдбар. */
export interface TheoryTree {
  tracks: TheoryTrackNode[];
}

/** Обзор трека: те же разделы плюс сводка по объёму. */
export interface TheoryTrackDetail {
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  articleCount: number;
  readingMinutes: number;
  sections: TheorySectionNode[];
}

/** Путь к статье: Теория → Трек → Раздел. У раздела своего URL нет. */
export interface TheoryBreadcrumb {
  trackSlug: string;
  trackName: string;
  sectionSlug: string;
  sectionName: string;
}

export interface TheoryArticleLink {
  slug: string;
  title: string;
  readingMinutes: number;
}

/** Вопрос каталога, привязанный к статье («Проверь себя»). */
export interface TheoryRelatedQuestion {
  id: string;
  slug: string;
  title: string;
  difficulty: number;
  level: Ref;
}

export interface TheoryArticleDetail {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  body: string;
  readingMinutes: number;
  viewCount: number;
  createdAt: string;
  updatedAt: string | null;
  status: TheoryStatus;
  level: Ref | null;
  breadcrumb: TheoryBreadcrumb;
  previous: TheoryArticleLink | null;
  next: TheoryArticleLink | null;
  relatedQuestions: TheoryRelatedQuestion[];
}

/** Трек в админском дереве: со скрытыми разделами и черновиками. */
export interface TheoryTrackAdmin {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  sortOrder: number;
  isPublished: boolean;
  articleCount: number;
  sections: TheorySectionAdmin[];
}

export interface TheorySectionAdmin {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  sortOrder: number;
  articleCount: number;
}

/** Строка админского списка статей — без тела. */
export interface TheoryArticleListItem {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  sortOrder: number;
  status: TheoryStatus;
  readingMinutes: number;
  viewCount: number;
  createdAt: string;
  updatedAt: string | null;
  sectionId: string;
  sectionName: string;
  trackName: string;
  level: Ref | null;
  relatedQuestionCount: number;
}

/** Статья в редакторе: тело плюс привязанные вопросы. */
export interface TheoryArticleAdmin {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  body: string;
  sortOrder: number;
  status: TheoryStatus;
  readingMinutes: number;
  viewCount: number;
  createdAt: string;
  updatedAt: string | null;
  sectionId: string;
  trackId: string;
  levelId: string | null;
  relatedQuestions: TheoryRelatedQuestion[];
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
