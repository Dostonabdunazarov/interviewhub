/**
 * Дымовой тест админки: рендерит страницы под залогиненным админом
 * и проверяет ключевые инварианты бэкенда, на которые опирается UI.
 *
 * Запуск: API на 5199, затем
 *   VITE_API_URL=http://localhost:5199 npx vite-node smoke/admin.tsx
 */
import { renderToString } from "react-dom/server";
import { StrictMode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { AdminLayout } from "../src/components/AdminLayout";
import { api, login } from "../src/lib/api";
import { adminKeys } from "../src/lib/adminHooks";
import { queryKeys } from "../src/lib/hooks";
import DashboardPage from "../src/pages/admin/DashboardPage";
import AdminQuestionsPage from "../src/pages/admin/AdminQuestionsPage";
import QuestionEditorPage from "../src/pages/admin/QuestionEditorPage";
import ReferencesPage from "../src/pages/admin/ReferencesPage";
import UsersPage from "../src/pages/admin/UsersPage";
import type { AuthUser, Category, Company, Level, QuestionDetail, Tag } from "../src/types/api";
import { QuestionStatus } from "../src/types/api";

const EMAIL = process.env.ADMIN_EMAIL ?? "admin@interview.hypex.site";
const PASSWORD = process.env.ADMIN_PASSWORD ?? "Admin123!";

let failures = 0;
function check(name: string, ok: boolean, extra = "") {
  if (ok) console.log(`  OK   ${name}`);
  else {
    failures++;
    console.log(`  FAIL ${name}${extra ? ` — ${extra}` : ""}`);
  }
}

const textOf = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");

const routes = [
  {
    element: <AdminLayout />,
    children: [
      { path: "/admin", element: <DashboardPage /> },
      { path: "/admin/questions", element: <AdminQuestionsPage /> },
      { path: "/admin/questions/new", element: <QuestionEditorPage /> },
      { path: "/admin/questions/:id", element: <QuestionEditorPage /> },
      { path: "/admin/references", element: <ReferencesPage /> },
      { path: "/admin/users", element: <UsersPage /> },
    ],
  },
];

/** Прогрев кэша: renderToString не ждёт эффектов, запросы из хуков не стартуют. */
async function prefetch(qc: QueryClient, path: string, questionId?: string) {
  const load = <T,>(key: readonly unknown[], url: string) =>
    qc.prefetchQuery({ queryKey: key, queryFn: async () => (await api.get<T>(url)).data });

  const loadAdminQuestions = (params: Record<string, unknown>) =>
    qc.prefetchQuery({
      queryKey: adminKeys.questions(params),
      queryFn: async () => (await api.get("/admin/questions", { params })).data,
    });

  await Promise.all([
    load<Category[]>(queryKeys.categories(), "/categories"),
    load<Level[]>(queryKeys.levels(), "/levels"),
    load<Company[]>(queryKeys.companies(), "/companies"),
    load<Tag[]>(adminKeys.tags(), "/admin/tags"),
    load(queryKeys.stats(), "/stats"),
  ]);

  if (path === "/admin") {
    await Promise.all([
      loadAdminQuestions({ status: "Draft", sort: "Newest", pageSize: 6 }),
      loadAdminQuestions({ status: "Published", sort: "Newest", pageSize: 6 }),
      loadAdminQuestions({ status: "Draft", pageSize: 1 }),
      loadAdminQuestions({ status: "Archived", pageSize: 1 }),
      loadAdminQuestions({ status: "All", pageSize: 1 }),
    ]);
  } else if (path === "/admin/questions") {
    await loadAdminQuestions({ status: "All", q: undefined, page: 1, pageSize: 20 });
  } else if (path === "/admin/users") {
    await load<AuthUser[]>(adminKeys.users(), "/admin/users");
  } else if (questionId) {
    await qc.prefetchQuery({
      queryKey: adminKeys.question(questionId),
      queryFn: async () => (await api.get(`/admin/questions/${questionId}`)).data,
    });
  }
}

async function renderRoute(path: string, questionId?: string): Promise<string> {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 60_000 } } });
  await prefetch(qc, path, questionId);

  const router = createMemoryRouter(routes, { initialEntries: [path] });
  return textOf(
    renderToString(
      <StrictMode>
        <QueryClientProvider client={qc}>
          <RouterProvider router={router} />
        </QueryClientProvider>
      </StrictMode>,
    ),
  );
}

async function run() {
  console.log("=== 1. Вход админом ===");
  const auth = await login(EMAIL, PASSWORD);
  check("логин", Boolean(auth.accessToken));

  console.log("\n=== 2. Рендер страниц админки ===");
  const dashboard = await renderRoute("/admin");
  check("дашборд", ["Дашборд", "черновиков", "Новый вопрос"].every((t) => dashboard.includes(t)));

  // На пустой базе (прод-стек без DemoContent) список показывает пустое
  // состояние вместо таблицы — это верное поведение, поэтому проверяем
  // шапку страницы и любой из двух исходов.
  const list = await renderRoute("/admin/questions");
  check(
    "список вопросов",
    list.includes("Вопросы") &&
      (list.includes("Заголовок") || list.includes("Вопросы не найдены")),
  );

  const editorNew = await renderRoute("/admin/questions/new");
  check(
    "редактор (новый)",
    ["Новый вопрос", "Заголовок", "Категория", "Грейд", "Постановка"].every((t) =>
      editorNew.includes(t),
    ),
  );

  const refs = await renderRoute("/admin/references");
  check("справочники", ["Справочники", "Категории", "Грейды", "Компании"].every((t) => refs.includes(t)));

  const users = await renderRoute("/admin/users");
  check("пользователи", ["Пользователи", "Email", "Роль"].every((t) => users.includes(t)));
  check("текущий админ в списке", users.includes(EMAIL));

  console.log("\n=== 3. Жизненный цикл вопроса ===");
  const categories = (await api.get<Category[]>("/categories")).data;
  const levels = (await api.get<Level[]>("/levels")).data;
  const companies = (await api.get<Company[]>("/companies")).data;

  const created = (
    await api.post<QuestionDetail>("/admin/questions", {
      title: "Дымовой тест: что такое индексы?",
      body: "ВАЖНЫЙ ТЕКСТ ПОСТАНОВКИ",
      slug: null,
      categoryId: categories[0].id,
      levelId: levels[0].id,
      difficulty: 3,
      status: QuestionStatus.Draft,
      isFeatured: false,
      companies: [{ companyId: companies[0].id, askedYear: 2025, round: 2 }],
      tagIds: [],
    })
  ).data;

  check("создание вопроса", Boolean(created.id));
  check("slug транслитерирован", created.slug.startsWith("dymovoi-test"), created.slug);

  const editorEdit = await renderRoute(`/admin/questions/${created.id}`, created.id);
  check(
    "редактор (правка) показывает данные",
    editorEdit.includes("Редактирование вопроса") && editorEdit.includes("Ответы"),
  );

  // Ответ добавляется отдельным эндпоинтом — как это делает редактор.
  const answer = (
    await api.post(`/admin/questions/${created.id}/answers`, {
      body: "Индекс — структура для ускорения поиска.",
      isPrimary: true,
      sortOrder: 0,
    })
  ).data as { id: string };
  check("добавление ответа", Boolean(answer.id));

  console.log("\n=== 4. Bulk не стирает тело вопроса ===");
  // Ровно то, что делает bulkSetStatus: GET детали, затем PUT со сменой статуса.
  const full = (await api.get<QuestionDetail>(`/admin/questions/${created.id}`)).data;
  await api.put(`/admin/questions/${created.id}`, {
    title: full.title,
    body: full.body,
    slug: null,
    categoryId: full.category.id,
    levelId: full.level.id,
    difficulty: full.difficulty,
    status: QuestionStatus.Published,
    isFeatured: full.isFeatured,
    companies: full.companies.map((c) => ({
      companyId: c.id,
      askedYear: c.askedYear,
      round: c.round,
    })),
    tagIds: full.tags.map((t) => t.id),
  });

  const afterBulk = (await api.get<QuestionDetail>(`/admin/questions/${created.id}`)).data;
  check("статус сменился", afterBulk.status === QuestionStatus.Published);
  check("тело сохранилось", afterBulk.body === "ВАЖНЫЙ ТЕКСТ ПОСТАНОВКИ", String(afterBulk.body));
  check("связь с компанией сохранилась", afterBulk.companies.length === 1);
  check("ответ на месте", afterBulk.answers.length === 1);

  console.log("\n=== 5. Ошибки бэкенда, которые показывает UI ===");
  // Категорию берём по свежим счётчикам: на пустой базе (прод-стек без
  // DemoContent) ни одна не используется, пока мы сами не создали вопрос —
  // а вопрос выше как раз создан и ещё не удалён.
  const fresh = (await api.get<Category[]>("/categories")).data;
  const usedCategory = fresh.find((c) => c.questionCount > 0);

  if (!usedCategory) {
    check("409 на удаление используемой категории", false, "нет категории с вопросами");
  } else {
    const conflict = await api
      .delete(`/admin/categories/${usedCategory.id}`)
      .then(() => 0)
      .catch((e) => e.response?.status ?? 0);
    check("409 на удаление используемой категории", conflict === 409, `получено ${conflict}`);
  }

  const me = (await api.get<AuthUser[]>("/admin/users")).data.find((u) => u.email === EMAIL)!;
  const lastAdmin = await api
    .put(`/admin/users/${me.id}`, {
      email: me.email,
      displayName: me.displayName,
      role: 1,
      isActive: true,
    })
    .then(() => 0)
    .catch((e) => e.response?.status ?? 0);
  check("409 на понижение последнего админа", lastAdmin === 409, `получено ${lastAdmin}`);

  console.log("\n=== 6. Уборка ===");
  await api.delete(`/admin/questions/${created.id}`);
  const gone = await api
    .get(`/admin/questions/${created.id}`)
    .then(() => 0)
    .catch((e) => e.response?.status ?? 0);
  check("вопрос удалён", gone === 404, `получено ${gone}`);

  console.log(failures === 0 ? "\nАдминка работает" : `\nПадений: ${failures}`);
  process.exit(failures === 0 ? 0 : 1);
}

await run();
