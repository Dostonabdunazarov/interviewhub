import { lazy, Suspense } from "react";
import { HelpCircle, type LucideProps } from "lucide-react";

/**
 * Иконка категории по имени из БД (`Categories.Icon`: "atom", "database", …).
 *
 * Через `DynamicIcon`, а не через карту `icons`: барельный импорт `{ icons }`
 * затаскивает в бандл все ~1600 иконок (≈800 кБ), тогда как реально
 * используются единицы. DynamicIcon грузит нужную отдельным чанком.
 *
 * Имена там в kebab-case — ровно в таком виде они и лежат в сидинге.
 */
const DynamicIcon = lazy(() =>
  import("lucide-react/dynamic").then((m) => ({ default: m.DynamicIcon })),
);

interface CategoryIconProps extends Omit<LucideProps, "name"> {
  name: string | null | undefined;
}

export function CategoryIcon({ name, ...props }: CategoryIconProps) {
  // Пустое имя незачем гонять через ленивый чанк — сразу фолбэк.
  if (!name) return <HelpCircle {...props} />;

  return (
    <Suspense fallback={<HelpCircle {...props} />}>
      {/* Неизвестное имя DynamicIcon отрисует как fallback: админ волен
          вписать что угодно, и это не должно ронять страницу. */}
      <DynamicIcon name={name as never} fallback={() => <HelpCircle {...props} />} {...props} />
    </Suspense>
  );
}
