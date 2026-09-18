import { Link } from "react-router-dom";
import { Clock } from "lucide-react";
import { useTheoryTree } from "../lib/theoryHooks";
import { Meta } from "../components/Meta";
import { Badge } from "../components/ui/Badge";
import { CategoryIcon } from "../components/ui/CategoryIcon";
import { Skeleton } from "../components/ui/Skeleton";
import { ErrorState } from "../components/ui/States";
import type { TheorySectionNode } from "../types/api";

/**
 * Полное оглавление раздела: все треки, разделы и статьи одним списком.
 * Это сразу витрина («что вообще есть»), рабочая навигация и SEO-узел —
 * все ссылки раздела в одном HTML.
 */

/** Время чтения и грейд: при двух сотнях статей видеть объём до клика важно. */
function ArticleRow({
  slug,
  title,
  readingMinutes,
  level,
}: TheorySectionNode["articles"][number]) {
  return (
    <li>
      <Link
        to={`/theory/articles/${slug}`}
        className="group flex items-center gap-3 rounded-control px-3 py-2
                   transition-colors hover:bg-surface-sunken"
      >
        <span className="min-w-0 flex-1 text-sm transition-colors group-hover:text-accent">
          {title}
        </span>

        <span className="flex shrink-0 items-center gap-1 text-xs tabular-nums text-fg-subtle">
          <Clock size={12} /> {readingMinutes} мин
        </span>

        {/* Грейд необязателен — у части статей его нет, и это нормально. */}
        {level && (
          <span className="hidden w-16 shrink-0 text-right text-xs text-fg-subtle sm:block">
            {level.name.toLowerCase()}
          </span>
        )}
      </Link>
    </li>
  );
}

function ContentsSkeleton() {
  return (
    <div className="flex flex-col gap-10" aria-hidden="true">
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i}>
          <Skeleton className="h-7 w-52" />
          <Skeleton className="mt-4 h-40 rounded-card" />
        </div>
      ))}
    </div>
  );
}

export default function TheoryContentsPage() {
  const { data, isLoading, isError, refetch } = useTheoryTree();

  if (isLoading) return <ContentsSkeleton />;

  if (isError || !data) {
    return <ErrorState title="Не удалось загрузить содержание" onRetry={() => refetch()} />;
  }

  const totalArticles = data.tracks.reduce((sum, t) => sum + t.articleCount, 0);

  return (
    <div>
      <Meta
        title="Теория"
        description="Конспекты по темам технических собеседований: C#, CLR, асинхронность, распределённые системы, алгоритмы и инфраструктура."
        path="/theory"
      />

      <h1 className="text-3xl font-semibold tracking-tight">Теория</h1>
      <p className="mt-3 text-base leading-relaxed text-fg-muted">
        Связные материалы, которые читают подряд, а не отдельные вопросы с ответами.
        Каждый трек — это то, что вы учите целиком; внутри разделы идут в порядке
        изучения.
      </p>

      {data.tracks.length === 0 ? (
        // Раздел наполняется постепенно, и пустое дерево — штатное состояние,
        // а не ошибка: тон соответствующий.
        <div className="mt-8 rounded-card border border-dashed border-border-subtle p-8
                        text-center">
          <p className="font-medium">Материалы ещё не опубликованы</p>
          <p className="mt-2 text-sm text-fg-muted">
            Раздел открывается по мере готовности статей. Пока всё готовое лежит в{" "}
            <Link to="/questions" className="text-accent transition-colors hover:underline">
              каталоге вопросов
            </Link>
            .
          </p>
        </div>
      ) : (
        <>
          <p className="mt-2 text-sm text-fg-subtle">
            {totalArticles} статей в {data.tracks.length} треках
          </p>

          {/* Между треками — воздух, чтобы страница просматривалась, а не читалась. */}
          <div className="mt-10 flex flex-col gap-12">
            {data.tracks.map((track) => (
              <section key={track.slug}>
                <div className="flex items-center gap-3">
                  <span
                    className="grid size-9 shrink-0 place-items-center rounded-control
                               bg-surface-sunken"
                    style={track.color ? { color: track.color } : undefined}
                  >
                    <CategoryIcon name={track.icon} size={18} />
                  </span>

                  <h2 className="text-xl font-semibold tracking-tight">
                    <Link to={`/theory/${track.slug}`} className="transition-colors hover:text-accent">
                      {track.name}
                    </Link>
                  </h2>

                  <Badge>{track.articleCount}</Badge>
                </div>

                {track.description && (
                  <p className="mt-2 text-sm text-fg-muted">{track.description}</p>
                )}

                <div className="mt-4 flex flex-col gap-4">
                  {track.sections.map((section) => (
                    <div
                      key={section.slug}
                      className="rounded-card border border-border-subtle bg-surface p-4"
                    >
                      <h3 className="px-3 text-sm font-medium">{section.name}</h3>
                      <ul className="mt-2 flex flex-col">
                        {section.articles.map((article) => (
                          <ArticleRow key={article.slug} {...article} />
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
