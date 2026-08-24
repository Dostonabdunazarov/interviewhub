import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useLevels } from "../lib/hooks";
import { Skeleton } from "../components/ui/Skeleton";
import { EmptyState, ErrorState } from "../components/ui/States";
import { formatCount } from "../lib/utils";

/**
 * Список грейдов. Отдельная страница нужна, чтобы на грейды можно было
 * попасть из навигации, а не только по ссылке из карточки вопроса.
 *
 * Порядок задаёт `rank` из БД (Intern → Lead), поэтому список отражает
 * карьерную последовательность, а не алфавит. Сервер отдаёт справочник уже
 * отсортированным, но сортируем и здесь: страница не должна зависеть от
 * того, что где-то на бэкенде сохранится нужный ORDER BY.
 */
export default function LevelsPage() {
  const { data, isLoading, isError, refetch } = useLevels();
  const levels = data ? [...data].sort((a, b) => a.rank - b.rank) : undefined;

  return (
    <div className="mx-auto max-w-content px-page-x py-10">
      <h1 className="text-3xl font-semibold tracking-tight">Грейды</h1>
      <p className="mt-2 max-w-2xl text-sm text-fg-muted">
        Вопросы, сгруппированные по уровню позиции — от стажёра до лида.
        Внутри грейда вопросы идут от простых к сложным.
      </p>

      <div className="mt-8">
        {isError ? (
          <ErrorState onRetry={() => refetch()} />
        ) : isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-[92px] rounded-card" />
            ))}
          </div>
        ) : levels && levels.length === 0 ? (
          <EmptyState description="Грейды ещё не добавлены." />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {levels?.map((level, i) => (
              <motion.div
                key={level.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: Math.min(i, 8) * 0.04 }}
              >
                <Link
                  to={`/levels/${level.slug}`}
                  className="group flex h-full items-center gap-4 rounded-card border
                             border-border-subtle bg-surface p-5 transition-colors
                             hover:border-border-strong"
                >
                  {/*
                    Цвет грейда — из БД (Levels.Color). Кружок вместо иконки:
                    у грейдов нет собственных символов, а цвет уже используется
                    в бейджах вопросов, так что связь узнаётся.
                  */}
                  <span
                    aria-hidden="true"
                    className="grid size-10 shrink-0 place-items-center rounded-full"
                    style={{
                      backgroundColor: level.color
                        ? `color-mix(in oklab, ${level.color} 16%, transparent)`
                        : undefined,
                    }}
                  >
                    <span
                      className="size-3.5 rounded-full"
                      style={{ backgroundColor: level.color ?? "var(--ih-fg-subtle)" }}
                    />
                  </span>

                  <span className="min-w-0">
                    <span className="block font-medium transition-colors group-hover:text-accent">
                      {level.name}
                    </span>
                    <span className="mt-0.5 block text-sm text-fg-muted">
                      {formatCount(level.questionCount)} вопросов
                    </span>
                  </span>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
