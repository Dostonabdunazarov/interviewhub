import { useParams } from "react-router-dom";
import { useCompany } from "../lib/hooks";
import { QuestionShowcase, ShowcaseCount } from "../components/QuestionShowcase";
import { CompanyLogo } from "../components/ui/CompanyLogo";
import { Skeleton } from "../components/ui/Skeleton";

export default function CompanyPage() {
  const { slug } = useParams();
  // У компаний, в отличие от категорий и грейдов, есть свой эндпоинт.
  const { data: company, isLoading } = useCompany(slug);

  const header = isLoading ? (
    <>
      <Skeleton className="h-9 w-56" />
      <Skeleton className="mt-2 h-4 w-40" />
    </>
  ) : (
    <>
      <div className="flex items-center gap-3">
        {company && <CompanyLogo company={company} className="size-11 text-base" />}
        <h1 className="text-3xl font-semibold tracking-tight">{company?.name ?? slug}</h1>
      </div>

      {company?.description && (
        <p className="mt-3 max-w-2xl text-sm text-fg-muted">{company.description}</p>
      )}
      {company?.country && <p className="mt-1 text-xs text-fg-subtle">{company.country}</p>}
      <ShowcaseCount count={company?.questionCount} />
    </>
  );

  return (
    <QuestionShowcase
      filter={{ company: slug }}
      header={header}
      emptyText="Для этой компании пока нет опубликованных вопросов."
    />
  );
}
