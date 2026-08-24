import { useParams } from "react-router-dom";
import { useCategories } from "../lib/hooks";
import { QuestionShowcase, ShowcaseCount } from "../components/QuestionShowcase";
import { CategoryIcon } from "../components/ui/CategoryIcon";
import { Skeleton } from "../components/ui/Skeleton";

export default function CategoryPage() {
  const { slug } = useParams();

  // Отдельного GET /api/categories/{slug} нет, а список всё равно закэширован
  // TanStack Query — берём нужную категорию из него, без лишнего запроса.
  const { data, isLoading } = useCategories();
  const category = data?.find((c) => c.slug === slug);

  const header = isLoading ? (
    <>
      <Skeleton className="h-9 w-64" />
      <Skeleton className="mt-2 h-4 w-40" />
    </>
  ) : (
    <>
      <div className="flex items-center gap-3">
        {category && (
          <span
            className="grid size-11 shrink-0 place-items-center rounded-control"
            style={{
              color: category.color ?? undefined,
              backgroundColor: category.color
                ? `color-mix(in oklab, ${category.color} 14%, transparent)`
                : undefined,
            }}
          >
            <CategoryIcon name={category.icon} size={22} />
          </span>
        )}
        <h1 className="text-3xl font-semibold tracking-tight">{category?.name ?? slug}</h1>
      </div>

      {category?.description && (
        <p className="mt-3 max-w-2xl text-sm text-fg-muted">{category.description}</p>
      )}
      <ShowcaseCount count={category?.questionCount} />
    </>
  );

  return (
    <QuestionShowcase
      filter={{ category: slug }}
      header={header}
      emptyText="В этой категории пока нет опубликованных вопросов."
    />
  );
}
