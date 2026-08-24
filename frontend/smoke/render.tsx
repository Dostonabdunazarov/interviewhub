/**
 * Дымовой тест публичных страниц: рендерит каждый роут через react-dom/server
 * против живого API и проверяет, что в разметке появился ожидаемый текст.
 *
 * Сборка ловит только типы. Здесь ловятся ошибки времени выполнения:
 * упавший хук, неверная форма ответа API, обращение к undefined.
 *
 * jsdom для этого не годится — он не исполняет <script type="module">,
 * поэтому SPA в нём просто не стартует.
 *
 * Запуск: поднять API на 5199 и `npx vite-node smoke/render.tsx`.
 */
import { renderToString } from "react-dom/server";
import { StrictMode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { api } from "../src/lib/api";
import { queryKeys } from "../src/lib/hooks";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { Layout } from "../src/components/Layout";
import HomePage from "../src/pages/HomePage";
import QuestionsPage from "../src/pages/QuestionsPage";
import QuestionPage from "../src/pages/QuestionPage";
import CategoryPage from "../src/pages/CategoryPage";
import LevelPage from "../src/pages/LevelPage";
import CompaniesPage from "../src/pages/CompaniesPage";
import CompanyPage from "../src/pages/CompanyPage";
import AboutPage from "../src/pages/AboutPage";
import NotFoundPage from "../src/pages/NotFoundPage";

const API = process.env.API_URL ?? "http://localhost:5199";

const routes = [
  {
    element: <Layout />,
    children: [
      { path: "/", element: <HomePage /> },
      { path: "/questions", element: <QuestionsPage /> },
      { path: "/questions/:slug", element: <QuestionPage /> },
      { path: "/categories/:slug", element: <CategoryPage /> },
      { path: "/levels/:slug", element: <LevelPage /> },
      { path: "/companies", element: <CompaniesPage /> },
      { path: "/companies/:slug", element: <CompanyPage /> },
      { path: "/about", element: <AboutPage /> },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
];

/**
 * Что должно оказаться в разметке. Сначала проверяем каркас страницы
 * (он рендерится сразу), затем — данные, ради которых страница и нужна.
 */
const CASES: { path: string; shell: string[]; data?: string[] }[] = [
  {
    path: "/",
    shell: ["Готовьтесь к собеседованию", "Категории", "Популярные вопросы"],
    data: ["React", "вопросов"],
  },
  { path: "/questions", shell: ["Каталог вопросов", "Сложность"], data: ["Junior"] },
  {
    // У этого вопроса единственный ответ помечен IsPrimary, поэтому он раскрыт
    // сразу и кнопка подписана «Скрыть», а не «Показать ответ».
    path: "/questions/postgres-index-basics",
    shell: ["Основной ответ", "Скрыть"],
    data: ["Спрашивали в компаниях", "PostgreSQL"],
  },
  { path: "/categories/react", shell: ["К каталогу"], data: ["React"] },
  { path: "/levels/junior", shell: ["К каталогу"], data: ["Junior"] },
  { path: "/companies", shell: ["Компании"], data: ["Google"] },
  // Логотип Google отдаётся как <img alt>, а не текстом, поэтому ищем
  // заголовок витрины и вопросы компании.
  { path: "/companies/google", shell: ["К каталогу"], data: ["вопросов", "Сложность"] },
  { path: "/about", shell: ["О проекте", "Как пользоваться"] },
  { path: "/no-such-page", shell: ["404", "Страница не найдена"] },
];

/** Текст без тегов — искать подстроку в сыром HTML ненадёжно. */
function textOf(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");
}

/**
 * Заполняет кэш теми же ключами, что использует приложение (`queryKeys`),
 * чтобы рендер отдал разметку с данными, а не скелетоны.
 */
async function prefetchFor(path: string, qc: QueryClient) {
  const url = new URL(path, "http://x");
  const seg = url.pathname.split("/").filter(Boolean);
  const slug = seg[1];

  const load = <T,>(key: readonly unknown[], endpoint: string) =>
    qc.prefetchQuery({
      queryKey: key,
      queryFn: async () => (await api.get<T>(endpoint)).data,
    });

  const params = (extra: Record<string, unknown> = {}) => ({
    page: 1,
    pageSize: 12,
    ...extra,
  });

  const loadQuestions = (p: Record<string, unknown>) =>
    qc.prefetchQuery({
      queryKey: queryKeys.questions(p),
      queryFn: async () => (await api.get("/questions", { params: p })).data,
    });

  await Promise.all([
    load(queryKeys.categories(), "/categories"),
    load(queryKeys.levels(), "/levels"),
    load(queryKeys.companies(), "/companies"),
    load(queryKeys.tags(), "/tags"),
    load(queryKeys.stats(), "/stats"),
  ]);

  if (url.pathname === "/") {
    await loadQuestions({ sort: "Popular", pageSize: 6 });
  } else if (url.pathname === "/questions") {
    await loadQuestions({
      category: undefined, level: undefined, company: undefined,
      tag: undefined, difficulty: undefined,
      q: url.searchParams.get("q") || undefined,
      sort: "Newest", ...params(),
    });
  } else if (seg[0] === "questions" && slug) {
    await qc.prefetchQuery({
      queryKey: queryKeys.question(slug),
      queryFn: async () => (await api.get(`/questions/${slug}`)).data,
    });
  } else if (seg[0] === "categories" && slug) {
    await loadQuestions(params({ category: slug }));
  } else if (seg[0] === "levels" && slug) {
    await loadQuestions(params({ level: slug }));
  } else if (seg[0] === "companies" && slug) {
    await Promise.all([
      qc.prefetchQuery({
        queryKey: queryKeys.company(slug),
        queryFn: async () => (await api.get(`/companies/${slug}`)).data,
      }),
      loadQuestions(params({ company: slug })),
    ]);
  }
}

async function run() {
  let failures = 0;

  for (const testCase of CASES) {
    const errors: string[] = [];
    const originalError = console.error;
    console.error = (...args: unknown[]) => {
      errors.push(args.map(String).join(" "));
    };

    // Свежий клиент на каждый роут: общий кэш скрыл бы падение запроса.
    // gcTime здесь обязателен: при значении 0 данные вычищаются сразу после
    // prefetch — подписчиков ещё нет, — и рендер видит пустой кэш через раз.
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 60_000 } },
    });

    let text = "";
    try {
      // renderToString не ждёт эффектов, поэтому запросы из хуков при SSR
      // не стартуют вовсе. Прогреваем кэш заранее — теми же ключами и функциями,
      // что и в приложении, — и тогда второй рендер видит данные.
      await prefetchFor(testCase.path, queryClient);

      const router = createMemoryRouter(routes, { initialEntries: [testCase.path] });
      text = textOf(
        renderToString(
          <StrictMode>
            <QueryClientProvider client={queryClient}>
              <RouterProvider router={router} />
            </QueryClientProvider>
          </StrictMode>,
        ),
      );
    } catch (err) {
      errors.push(`исключение: ${(err as Error).message}`);
    } finally {
      console.error = originalError;
    }

    const expected = [...testCase.shell, ...(testCase.data ?? [])];
    const missing = expected.filter((needle) => !text.includes(needle));
    const realErrors = errors.filter((e) => !/Warning:|useLayoutEffect|hydrat/i.test(e));

    if (missing.length === 0 && realErrors.length === 0) {
      console.log(`  OK   ${testCase.path}`);
    } else {
      failures++;
      console.log(`  FAIL ${testCase.path}`);
      if (missing.length) console.log(`       нет текста: ${missing.join(" | ")}`);
      for (const e of realErrors.slice(0, 2)) console.log(`       ошибка: ${e.slice(0, 250)}`);
    }
  }

  console.log(failures === 0 ? "\nВсе страницы отрисовались" : `\nПадений: ${failures}`);
  process.exit(failures === 0 ? 0 : 1);
}

console.log(`API: ${API}`);
await run();
