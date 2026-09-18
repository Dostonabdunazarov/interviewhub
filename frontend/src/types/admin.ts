/**
 * Тела запросов админского API. Соответствуют `Application/Dtos/AdminDtos.cs`.
 * Ответы переиспользуют публичные типы из `./api`.
 */
import type { InterviewRound, QuestionStatus, TheoryStatus, UserRole } from "./api";

export interface QuestionCompanyInput {
  companyId: string;
  askedYear: number | null;
  round: InterviewRound | null;
}

export interface QuestionInput {
  title: string;
  body: string | null;
  /** Пустой — бэкенд сгенерирует из title с транслитерацией кириллицы. */
  slug: string | null;
  categoryId: string;
  levelId: string;
  difficulty: number;
  status: QuestionStatus;
  isFeatured: boolean;
  companies: QuestionCompanyInput[];
  tagIds: string[];
}

export interface AnswerInput {
  body: string;
  isPrimary: boolean;
  sortOrder: number;
}

export interface CategoryInput {
  name: string;
  slug: string | null;
  description: string | null;
  /** Имя иконки lucide в kebab-case: "atom", "database". */
  icon: string | null;
  color: string | null;
  sortOrder: number;
}

export interface LevelInput {
  name: string;
  slug: string | null;
  rank: number;
  color: string | null;
}

export interface CompanyInput {
  name: string;
  slug: string | null;
  logoUrl: string | null;
  color: string | null;
  description: string | null;
  country: string | null;
  sortOrder: number;
}

export interface TagInput {
  name: string;
  slug: string | null;
}

export interface UserInput {
  email: string;
  displayName: string;
  role: UserRole;
  isActive: boolean;
}

export interface UserCreateInput extends UserInput {
  password: string;
}

export interface ChangePasswordInput {
  newPassword: string;
}

// ── Теория ──────────────────────────────────────────────────────────────────

export interface TheoryTrackInput {
  name: string;
  slug: string | null;
  description: string | null;
  /** Имя иконки lucide в kebab-case. */
  icon: string | null;
  color: string | null;
  sortOrder: number;
  isPublished: boolean;
}

export interface TheorySectionInput {
  name: string;
  slug: string | null;
  description: string | null;
  sortOrder: number;
  trackId: string;
}

/** readingMinutes здесь нет: его считает бэкенд из body. */
export interface TheoryArticleInput {
  title: string;
  slug: string | null;
  summary: string | null;
  body: string;
  sortOrder: number;
  status: TheoryStatus;
  sectionId: string;
  levelId: string | null;
  questionIds: string[];
}
