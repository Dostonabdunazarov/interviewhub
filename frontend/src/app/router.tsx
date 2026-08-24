import { lazy, Suspense } from "react";
import { createBrowserRouter, Outlet } from "react-router-dom";
import { Layout } from "../components/Layout";
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
const LoginPage = lazy(() => import("../pages/admin/LoginPage"));

import HomePage from "../pages/HomePage";
import QuestionsPage from "../pages/QuestionsPage";
import QuestionPage from "../pages/QuestionPage";
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
