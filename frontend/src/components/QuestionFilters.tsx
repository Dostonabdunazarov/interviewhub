import { X } from "lucide-react";
import { useCategories, useCompanies, useLevels, useTags } from "../lib/hooks";
import { Skeleton } from "./ui/Skeleton";
import { Button } from "./ui/Button";
import { cn } from "../lib/utils";

export interface FilterValues {
  category?: string;
  level?: string;
  company?: string;
  tag?: string;
  difficulty?: number;
}

interface Props {
  values: FilterValues;
  onChange: (patch: Partial<FilterValues>) => void;
  onReset: () => void;
  /** Скрывается фильтр, по которому страница уже сужена (витрина категории). */
  hide?: Array<keyof FilterValues>;
}

/** Кнопка-строка фильтра: повторный клик по активному значению снимает его. */
function FilterRow({
  active,
  onClick,
  children,
  count,
  color,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  count?: number;
  color?: string | null;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex w-full items-center justify-between gap-2 rounded-control px-2.5 py-1.5",
        "text-left text-sm transition-colors",
        active ? "bg-surface-sunken font-medium text-fg" : "text-fg-muted hover:text-fg",
      )}
    >
      <span className="flex min-w-0 items-center gap-2">
        {color && (
          <span
            aria-hidden="true"
            className="size-2 shrink-0 rounded-full"
            style={{ backgroundColor: color }}
          />
        )}
        <span className="truncate">{children}</span>
      </span>
      {count !== undefined && <span className="shrink-0 text-xs text-fg-subtle">{count}</span>}
    </button>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="px-2.5 text-xs font-semibold uppercase tracking-wide text-fg-subtle">
        {title}
      </h3>
      <div className="mt-1.5 flex flex-col gap-0.5">{children}</div>
    </div>
  );
}

function GroupSkeleton() {
  return (
    <div className="flex flex-col gap-1.5">
      <Skeleton className="h-3 w-20" />
      {Array.from({ length: 4 }, (_, i) => (
        <Skeleton key={i} className="h-7 w-full" />
      ))}
    </div>
  );
}

export function QuestionFilters({ values, onChange, onReset, hide = [] }: Props) {
  const categories = useCategories();
  const levels = useLevels();
  const companies = useCompanies();
  const tags = useTags();

  const visible = (key: keyof FilterValues) => !hide.includes(key);
  const hasAny = Object.values(values).some((v) => v !== undefined && v !== "");

  /** Клик по активному значению снимает фильтр — иначе сбросить его можно
      только кнопкой «Сбросить всё», что неудобно. */
  const toggle = <K extends keyof FilterValues>(key: K, value: FilterValues[K]) =>
    onChange({ [key]: values[key] === value ? undefined : value } as Partial<FilterValues>);

  return (
    <div className="flex flex-col gap-6">
      {hasAny && (
        <Button variant="secondary" size="sm" onClick={onReset} className="self-start">
          <X size={14} /> Сбросить фильтры
        </Button>
      )}

      {visible("category") &&
        (categories.isLoading ? (
          <GroupSkeleton />
        ) : (
          <Group title="Категория">
            {categories.data?.map((c) => (
              <FilterRow
                key={c.id}
                active={values.category === c.slug}
                onClick={() => toggle("category", c.slug)}
                count={c.questionCount}
                color={c.color}
              >
                {c.name}
              </FilterRow>
            ))}
          </Group>
        ))}

      {visible("level") &&
        (levels.isLoading ? (
          <GroupSkeleton />
        ) : (
          <Group title="Грейд">
            {levels.data?.map((l) => (
              <FilterRow
                key={l.id}
                active={values.level === l.slug}
                onClick={() => toggle("level", l.slug)}
                count={l.questionCount}
                color={l.color}
              >
                {l.name}
              </FilterRow>
            ))}
          </Group>
        ))}

      <Group title="Сложность">
        <div className="flex flex-wrap gap-1.5 px-2.5">
          {[1, 2, 3, 4, 5].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => toggle("difficulty", d)}
              aria-pressed={values.difficulty === d}
              aria-label={`Сложность ${d}`}
              className={cn(
                "size-8 rounded-control border text-sm transition-colors",
                values.difficulty === d
                  ? "border-transparent gradient-brand font-medium text-white"
                  : "border-border-subtle text-fg-muted hover:border-border-strong hover:text-fg",
              )}
            >
              {d}
            </button>
          ))}
        </div>
      </Group>

      {visible("company") &&
        (companies.isLoading ? (
          <GroupSkeleton />
        ) : (
          <Group title="Компания">
            {companies.data
              // Компании без вопросов в фильтре бесполезны — выбор вёл бы в пустоту.
              ?.filter((c) => c.questionCount > 0)
              .map((c) => (
                <FilterRow
                  key={c.id}
                  active={values.company === c.slug}
                  onClick={() => toggle("company", c.slug)}
                  count={c.questionCount}
                >
                  {c.name}
                </FilterRow>
              ))}
          </Group>
        ))}

      {visible("tag") && !tags.isLoading && (tags.data?.length ?? 0) > 0 && (
        <Group title="Теги">
          <div className="flex flex-wrap gap-1.5 px-2.5">
            {tags.data?.slice(0, 20).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => toggle("tag", t.slug)}
                aria-pressed={values.tag === t.slug}
                className={cn(
                  "rounded-pill border px-2.5 py-1 text-xs transition-colors",
                  values.tag === t.slug
                    ? "border-transparent gradient-brand font-medium text-white"
                    : "border-border-subtle text-fg-muted hover:border-border-strong hover:text-fg",
                )}
              >
                {t.name}
              </button>
            ))}
          </div>
        </Group>
      )}
    </div>
  );
}
