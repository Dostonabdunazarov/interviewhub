import { Link } from "react-router-dom";
import { Archive, FileEdit, FilePlus2, FileText, Layers } from "lucide-react";
import { useAdminQuestions } from "../../lib/adminHooks";
import { useStats } from "../../lib/hooks";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Skeleton } from "../../components/ui/Skeleton";
import { EmptyState } from "../../components/ui/States";
import { formatCount, formatDate } from "../../lib/utils";
import type { QuestionListItem } from "../../types/api";

function StatCard({
  icon: Icon,
  label,
  value,
  to,
  loading,
}: {
  icon: typeof FileText;
  label: string;
  value: number | undefined;
  to: string;
  loading: boolean;
}) {
  return (
    <Link
      to={to}
      className="rounded-card border border-border-subtle bg-surface p-4 transition-colors
                 hover:border-border-strong"
    >
      <Icon size={18} className="text-accent" />
      {loading ? (
        <Skeleton className="mt-2 h-7 w-12" />
      ) : (
        <p className="mt-2 text-2xl font-semibold tabular-nums">{formatCount(value ?? 0)}</p>
      )}
      <p className="mt-0.5 text-xs text-fg-muted">{label}</p>
    </Link>
  );
}

function QuestionRow({ question }: { question: QuestionListItem }) {
  return (
    <Link
      to={`/admin/questions/${question.id}`}
      className="flex items-center gap-3 rounded-control px-3 py-2.5 transition-colors
                 hover:bg-surface-sunken"
    >
      <span className="min-w-0 flex-1 truncate text-sm">{question.title}</span>
      <Badge color={question.category.color}>{question.category.name}</Badge>
      <span className="hidden shrink-0 text-xs text-fg-subtle sm:inline">
        {formatDate(question.createdAt)}
      </span>
    </Link>
  );
}

function QuestionList({
  title,
  status,
  emptyText,
  icon: Icon,
}: {
  title: string;
  status: "Draft" | "Published";
  emptyText: string;
  icon: typeof FileEdit;
}) {
  const { data, isLoading } = useAdminQuestions({ status, sort: "Newest", pageSize: 6 });

  return (
    <section className="rounded-card border border-border-subtle bg-surface p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-medium">
          <Icon size={16} className="text-fg-muted" />
          {title}
        </h2>
        <Link
          to={`/admin/questions?status=${status}`}
          className="text-sm text-accent transition-colors hover:text-accent-hover"
        >
          Все →
        </Link>
      </div>

      <div className="mt-3 flex flex-col">
        {isLoading ? (
          Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="my-1 h-9" />)
        ) : data && data.items.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-fg-subtle">{emptyText}</p>
        ) : (
          data?.items.map((q) => <QuestionRow key={q.id} question={q} />)
        )}
      </div>
    </section>
  );
}

export default function DashboardPage() {
  const stats = useStats();

  // Счётчики по статусам: totalCount из ответа, сами элементы не нужны.
  const drafts = useAdminQuestions({ status: "Draft", pageSize: 1 });
  const archived = useAdminQuestions({ status: "Archived", pageSize: 1 });
  const all = useAdminQuestions({ status: "All", pageSize: 1 });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Дашборд</h1>
        <Link to="/admin/questions/new">
          <Button>
            <FilePlus2 size={16} /> Новый вопрос
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          icon={FileText}
          label="всего вопросов"
          value={all.data?.totalCount}
          to="/admin/questions?status=All"
          loading={all.isLoading}
        />
        <StatCard
          icon={FileEdit}
          label="черновиков"
          value={drafts.data?.totalCount}
          to="/admin/questions?status=Draft"
          loading={drafts.isLoading}
        />
        <StatCard
          icon={Archive}
          label="в архиве"
          value={archived.data?.totalCount}
          to="/admin/questions?status=Archived"
          loading={archived.isLoading}
        />
        <StatCard
          icon={Layers}
          label="категорий"
          value={stats.data?.totalCategories}
          to="/admin/references"
          loading={stats.isLoading}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <QuestionList
          title="Черновики"
          status="Draft"
          icon={FileEdit}
          emptyText="Черновиков нет — всё опубликовано."
        />
        <QuestionList
          title="Недавно опубликованные"
          status="Published"
          icon={FileText}
          emptyText="Опубликованных вопросов пока нет."
        />
      </div>

      {all.data?.totalCount === 0 && (
        <EmptyState
          title="База пуста"
          description="Начните с первого вопроса — категории и грейды уже засеяны."
          action={
            <Link to="/admin/questions/new">
              <Button>Создать вопрос</Button>
            </Link>
          }
        />
      )}
    </div>
  );
}
