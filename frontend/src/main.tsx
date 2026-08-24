import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "react-router-dom";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { Toaster } from "./components/Toaster";
import { bootstrapAuth } from "./lib/api";
import { queryClient } from "./lib/queryClient";
import { router } from "./app/router";
import "./index.css";

// Пробуем восстановить сессию до первой отрисовки роутера, но не блокируем её:
// гостю админка не нужна, а ProtectedRoute сам подождёт флага initialized.
void bootstrapAuth();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
        {/* Вне роутера: тосты должны переживать смену страницы. */}
        <Toaster />
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
);
