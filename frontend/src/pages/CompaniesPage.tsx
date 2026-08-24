import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useCompanies } from "../lib/hooks";
import { CompanyLogo } from "../components/ui/CompanyLogo";
import { Skeleton } from "../components/ui/Skeleton";
import { EmptyState, ErrorState } from "../components/ui/States";
import { formatCount } from "../lib/utils";

export default function CompaniesPage() {
  const { data, isLoading, isError, refetch } = useCompanies();

  return (
    <div className="mx-auto max-w-content px-page-x py-10">
      <h1 className="text-3xl font-semibold tracking-tight">Компании</h1>
      <p className="mt-2 max-w-2xl text-sm text-fg-muted">
        Вопросы, сгруппированные по компаниям — с годом и этапом собеседования,
        на котором их задавали.
      </p>

      <div className="mt-8">
        {isError ? (
          <ErrorState onRetry={() => refetch()} />
        ) : isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 9 }, (_, i) => (
              <Skeleton key={i} className="h-24 rounded-card" />
            ))}
          </div>
        ) : data && data.length === 0 ? (
          <EmptyState description="Компании ещё не добавлены." />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data?.map((company, i) => (
              <motion.div
                key={company.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: Math.min(i, 8) * 0.04 }}
              >
                <Link
                  to={`/companies/${company.slug}`}
                  className="group flex h-full items-center gap-4 rounded-card border
                             border-border-subtle bg-surface p-5 transition-colors
                             hover:border-border-strong"
                >
                  {/* Логотип с фолбэком на буквы: часть компаний намеренно без LogoUrl. */}
                  <CompanyLogo company={company} className="size-12 text-base" />

                  <span className="min-w-0">
                    <span className="block font-medium transition-colors group-hover:text-accent">
                      {company.name}
                    </span>
                    <span className="mt-0.5 block text-xs text-fg-subtle">
                      {formatCount(company.questionCount)} вопросов
                      {company.country && ` · ${company.country}`}
                    </span>
                  </span>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
