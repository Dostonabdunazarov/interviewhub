import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { useTheoryTree } from "../lib/theoryHooks";
import { Skeleton } from "./ui/Skeleton";
import { cn } from "../lib/utils";
import type { TheoryTree, TheoryTrackNode } from "../types/api";

/**
 * Дерево теории: Трек → Раздел → Статья. Четвёртого уровня нет намеренно —
 * он не помещается в колонку 280px и его невозможно охватить взглядом.
 *
 * Раскрыт только путь к текущей статье, поэтому в колонке одновременно видно
 * шесть треков и разделы одного из них — порядка 15 строк, а не 190.
 */

/**
 * Где мы находимся в дереве. Считается из URL, а не хранится в состоянии:
 * переход по ссылке из текста статьи обязан раскрыть нужную ветку, а
 * useState об этом переходе не узнает.
 */
function useActivePath(tree: TheoryTree | undefined) {
  const { slug: articleSlug, trackSlug } = useParams();

  return useMemo(() => {
    if (!tree) return { trackSlug, sectionSlug: undefined as string | undefined, articleSlug };

    // На /theory/:trackSlug статьи нет — активен только трек.
    if (!articleSlug) return { trackSlug, sectionSlug: undefined, articleSlug: undefined };

    for (const track of tree.tracks)
      for (const section of track.sections)
        if (section.articles.some((a) => a.slug === articleSlug))
          return { trackSlug: track.slug, sectionSlug: section.slug, articleSlug };

    return { trackSlug, sectionSlug: undefined, articleSlug };
  }, [tree, articleSlug, trackSlug]);
}

/**
 * Ручное раскрытие поверх URL. Отдельный Set с ключами вида "track:slug" —
 * это разница с автоматическим состоянием, а не его замена: закрыть ветку
 * текущей статьи тоже можно.
 */
function useManualToggles() {
  const location = useLocation();
  const [opened, setOpened] = useState<Set<string>>(new Set());
  const [closed, setClosed] = useState<Set<string>>(new Set());

  // При переходе на другую статью ручные правки сбрасываются: иначе ветка,
  // закрытая руками час назад, спрячет статью, которую человек только открыл.
  useEffect(() => {
    setOpened(new Set());
    setClosed(new Set());
  }, [location.pathname]);

  const toggle = (key: string, isOpenNow: boolean) => {
    const add = (s: Set<string>) => new Set(s).add(key);
    const remove = (s: Set<string>) => {
      const next = new Set(s);
      next.delete(key);
      return next;
    };

    if (isOpenNow) {
      setClosed(add);
      setOpened(remove);
    } else {
      setOpened(add);
      setClosed(remove);
    }
  };

  const isOpen = (key: string, byUrl: boolean) =>
    opened.has(key) ? true : closed.has(key) ? false : byUrl;

  return { isOpen, toggle };
}

function Chevron({ open }: { open: boolean }) {
  return (
    <ChevronRight
      size={14}
      aria-hidden="true"
      className={cn("shrink-0 text-fg-subtle transition-transform", open && "rotate-90")}
    />
  );
}

function TrackBranch({
  track,
  active,
  isOpen,
  toggle,
}: {
  track: TheoryTrackNode;
  active: ReturnType<typeof useActivePath>;
  isOpen: (key: string, byUrl: boolean) => boolean;
  toggle: (key: string, isOpenNow: boolean) => void;
}) {
  const trackKey = `track:${track.slug}`;
  const trackOpen = isOpen(trackKey, active.trackSlug === track.slug);

  return (
    <li>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => toggle(trackKey, trackOpen)}
          aria-expanded={trackOpen}
          aria-label={trackOpen ? `Свернуть ${track.name}` : `Развернуть ${track.name}`}
          className="grid size-6 shrink-0 place-items-center rounded-control
                     hover:bg-surface-sunken"
        >
          <Chevron open={trackOpen} />
        </button>

        {/*
          Трек — заголовок группы, а не ссылка равного веса со статьёй:
          мелкий шрифт в верхнем регистре. Это и есть способ уложить три
          уровня в узкую колонку, не уменьшая шрифт статей.
        */}
        <Link
          to={`/theory/${track.slug}`}
          className={cn(
            "min-w-0 flex-1 truncate rounded-control px-1.5 py-1 text-xs font-semibold",
            "uppercase tracking-wide transition-colors",
            active.trackSlug === track.slug
              ? "text-fg"
              : "text-fg-subtle hover:text-fg-muted",
          )}
        >
          {track.name}
        </Link>

        {/* Как и у раздела: объём свёрнутой ветки виден до клика. */}
        {!trackOpen && (
          <span className="shrink-0 pr-1 text-xs tabular-nums text-fg-subtle">
            {track.articleCount}
          </span>
        )}
      </div>

      {trackOpen && (
        // Отступ 12px на уровень — предел, за которым заголовок статьи
        // начинает переноситься на три строки.
        <ul className="ml-3 mt-0.5 flex flex-col gap-0.5">
          {track.sections.map((section) => {
            const sectionKey = `section:${track.slug}/${section.slug}`;
            const sectionOpen = isOpen(sectionKey, active.sectionSlug === section.slug);

            return (
              <li key={section.slug}>
                <button
                  type="button"
                  onClick={() => toggle(sectionKey, sectionOpen)}
                  aria-expanded={sectionOpen}
                  className="flex w-full items-center gap-1.5 rounded-control py-1 pl-0.5 pr-1.5
                             text-left text-sm text-fg-muted transition-colors
                             hover:bg-surface-sunken hover:text-fg"
                >
                  <Chevron open={sectionOpen} />
                  <span className="min-w-0 flex-1 truncate">{section.name}</span>
                  {/* Счётчик у свёрнутого раздела — чтобы объём был виден до клика. */}
                  {!sectionOpen && (
                    <span className="shrink-0 text-xs tabular-nums text-fg-subtle">
                      {section.articleCount}
                    </span>
                  )}
                </button>

                {sectionOpen && (
                  // У статей отступа нет: по плану это первое, что убирают,
                  // если в колонке становится тесно. Строку держит граница слева.
                  <ul className="ml-2 flex flex-col gap-0.5 border-l border-border-subtle pl-2">
                    {section.articles.map((article) => {
                      const isActive = active.articleSlug === article.slug;

                      return (
                        <li key={article.slug}>
                          <Link
                            to={`/theory/articles/${article.slug}`}
                            aria-current={isActive ? "page" : undefined}
                            // Якорь для прокрутки к активному пункту.
                            data-active-article={isActive ? "true" : undefined}
                            className={cn(
                              "block rounded-control px-2 py-1 text-sm transition-colors",
                              isActive
                                ? "bg-surface-sunken font-medium text-fg"
                                : "text-fg-muted hover:text-fg",
                            )}
                          >
                            {article.title}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
}

function SidebarSkeleton() {
  return (
    // Ширина фиксирована и совпадает с готовым деревом: иначе контент
    // прыгает вбок, когда дерево догрузится.
    <div className="flex flex-col gap-2" aria-hidden="true">
      {Array.from({ length: 6 }, (_, i) => (
        <Skeleton key={i} className="h-5 w-full" />
      ))}
    </div>
  );
}

export function TheorySidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { data, isLoading } = useTheoryTree();
  const active = useActivePath(data);
  const { isOpen, toggle } = useManualToggles();
  const navRef = useRef<HTMLElement>(null);

  // Прокрутка к активной статье при прямом заходе по ссылке: иначе человек
  // открывает статью и не видит, где он в дереве. `block: "nearest"` —
  // чтобы не дёргать колонку, когда пункт и так на виду.
  useEffect(() => {
    if (!data) return;
    navRef.current
      ?.querySelector("[data-active-article]")
      ?.scrollIntoView({ block: "nearest" });
  }, [data, active.articleSlug]);

  return (
    <nav ref={navRef} aria-label="Содержание раздела «Теория»" onClick={onNavigate}>
      <Link
        to="/theory"
        className="mb-3 block text-xs font-semibold uppercase tracking-wide text-fg-muted
                   transition-colors hover:text-fg"
      >
        Всё содержание
      </Link>

      {isLoading ? (
        <SidebarSkeleton />
      ) : !data || data.tracks.length === 0 ? (
        <p className="text-sm text-fg-subtle">Материалы ещё не опубликованы.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {data.tracks.map((track) => (
            <TrackBranch
              key={track.slug}
              track={track}
              active={active}
              isOpen={isOpen}
              toggle={toggle}
            />
          ))}
        </ul>
      )}
    </nav>
  );
}
