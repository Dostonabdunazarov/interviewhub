import { useParams } from "react-router-dom";
import { useLevels } from "../lib/hooks";
import { QuestionShowcase, ShowcaseCount } from "../components/QuestionShowcase";
import { Meta } from "../components/Meta";
import { Skeleton } from "../components/ui/Skeleton";

export default function LevelPage() {
  const { slug } = useParams();
  const { data, isLoading } = useLevels();
  const level = data?.find((l) => l.slug === slug);

  const header = isLoading ? (
    <>
      <Skeleton className="h-9 w-48" />
      <Skeleton className="mt-2 h-4 w-32" />
    </>
  ) : (
    <>
      {level && (
        <Meta
          title={`Вопросы для ${level.name}`}
          description={`${level.questionCount} вопросов с собеседований уровня ${level.name} с разобранными ответами.`}
          path={`/levels/${level.slug}`}
        />
      )}

      <div className="flex items-center gap-3">
        {/* Цвет грейда — из БД (Levels.Color), хардкодить его планом запрещено. */}
        {level?.color && (
          <span
            aria-hidden="true"
            className="size-3 shrink-0 rounded-full"
            style={{ backgroundColor: level.color }}
          />
        )}
        <h1 className="text-3xl font-semibold tracking-tight">{level?.name ?? slug}</h1>
      </div>
      <p className="mt-3 max-w-2xl text-sm text-fg-muted">
        Вопросы, которые задают на этом грейде.
      </p>
      <ShowcaseCount count={level?.questionCount} />
    </>
  );

  return (
    <QuestionShowcase
      filter={{ level: slug }}
      header={header}
      emptyText="Для этого грейда пока нет опубликованных вопросов."
    />
  );
}
