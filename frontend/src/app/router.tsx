import { lazy, Suspense } from "react";
import { createBrowserRouter, Outlet } from "react-router-dom";
import { Layout } from "../components/Layout";
import { TheoryLayout } from "../components/TheoryLayout";
import { AdminLayout } from "../components/AdminLayout";
import { ProtectedRoute } from "../components/ProtectedRoute";
import { ScrollToTop } from "../components/ScrollToTop";

/**
 * Админка грузится отдельным чанком: гостей она не касается,
 * а тянуть редактор в бандл главной страницы незачем.
 * Публичные страницы остаются в основном бандле — их открывают сразу.
 */
const DashboardPage = lazy(() => import("../pages/admin/DashboardPage"));
const AdminQuestionsPage = lazy(() => import("../pages/admin/AdminQuestionsPage"));
const QuestionEditorPage = lazy(() => import("../pages/admin/QuestionEditorPage"));
const ReferencesPage = lazy(() => import("../pages/admin/ReferencesPage"));
const UsersPage = lazy(() => import("../pages/admin/UsersPage"));
const AdminTheoryPage = lazy(() => import("../pages/admin/AdminTheoryPage"));
const TheoryArticleEditorPage = lazy(() => import("../pages/admin/TheoryArticleEditorPage"));
const LoginPage = lazy(() => import("../pages/admin/LoginPage"));

import HomePage from "../pages/HomePage";
import QuestionsPage from "../pages/QuestionsPage";
import QuestionPage from "../pages/QuestionPage";
import TheoryContentsPage from "../pages/TheoryContentsPage";
import TheoryTrackPage from "../pages/TheoryTrackPage";
import TheoryArticlePage from "../pages/TheoryArticlePage";
import CategoryPage from "../pages/CategoryPage";
import LevelsPage from "../pages/LevelsPage";
import LevelPage from "../pages/LevelPage";
import CompaniesPage from "../pages/CompaniesPage";
import CompanyPage from "../pages/CompanyPage";
import AboutPage from "../pages/AboutPage";
import NotFoundPage from "../pages/NotFoundPage";

function Loading() {
  return <div className="grid min-h-dvh place-items-center text-sm text-fg-muted">Загрузка…</div>;
}

/** ScrollToTop живёт здесь: ему нужен роутерный контекст, а Layout есть не у всех веток. */
function Root() {
  return (
    <>
      <ScrollToTop />
      <Suspense fallback={<Loading />}>
        <Outlet />
      </Suspense>
    </>
  );
}

export const router = createBrowserRouter([
  {
    element: <Root />,
    children: [
      {
        element: <Layout />,
        children: [
          { path: "/", element: <HomePage /> },
          { path: "/questions", element: <QuestionsPage /> },
          { path: "/questions/:slug", element: <QuestionPage /> },
          { path: "/categories/:slug", element: <CategoryPage /> },

          // Теория — вложенный layout: сайдбар не должен перемонтироваться
          // при переходе между статьями, иначе сбрасывается прокрутка колонки.
          {
            path: "/theory",
            element: <TheoryLayout />,
            children: [
              { index: true, element: <TheoryContentsPage /> },
              { path: ":trackSlug", element: <TheoryTrackPage /> },
              { path: "articles/:slug", element: <TheoryArticlePage /> },
            ],
          },
          { path: "/levels", element: <LevelsPage /> },
          { path: "/levels/:slug", element: <LevelPage /> },
          { path: "/companies", element: <CompaniesPage /> },
          { path: "/companies/:slug", element: <CompanyPage /> },
          { path: "/about", element: <AboutPage /> },
          { path: "*", element: <NotFoundPage /> },
        ],
      },

      // Логин вне ProtectedRoute — иначе войти было бы невозможно.
      { path: "/admin/login", element: <LoginPage /> },

      {
        path: "/admin",
        element: <ProtectedRoute />,
        children: [
          {
            element: <AdminLayout />,
            children: [
              { index: true, element: <DashboardPage /> },
              { path: "questions", element: <AdminQuestionsPage /> },
              { path: "questions/new", element: <QuestionEditorPage /> },
              { path: "questions/:id", element: <QuestionEditorPage /> },
              { path: "references", element: <ReferencesPage /> },
              { path: "theory", element: <AdminTheoryPage /> },
              { path: "theory/articles/new", element: <TheoryArticleEditorPage /> },
              { path: "theory/articles/:id", element: <TheoryArticleEditorPage /> },
              {
                // Вложенный ProtectedRoute с requireAdmin: Editor сюда не пройдёт,
                // как и на /api/admin/users на бэкенде.
                element: <ProtectedRoute requireAdmin />,
                children: [{ path: "users", element: <UsersPage /> }],
              },
            ],
          },
        ],
      },
    ],
  },
]);
