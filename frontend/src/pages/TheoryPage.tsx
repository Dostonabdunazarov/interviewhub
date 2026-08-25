import { Link } from "react-router-dom";
import { BookOpen, Construction, FileCode2, GitBranch, Route } from "lucide-react";
import { Button } from "../components/ui/Button";
import { Meta } from "../components/Meta";

/** Что появится в разделе, когда он будет готов. */
const PLANNED = [
  {
    icon: BookOpen,
    title: "Конспекты по темам",
    text: "Связные разборы вместо разрозненных вопросов: CLR, EF Core, PostgreSQL, сети, конкурентность.",
  },
  {
    icon: Route,
    title: "Дорожные карты",
    text: "Порядок изучения по грейдам — что нужно знать на junior, а что спросят только у senior.",
  },
  {
    icon: FileCode2,
    title: "Примеры кода",
    text: "Разбор на живом коде с пояснениями, а не только текстом: как работает, где ломается.",
  },
  {
    icon: GitBranch,
    title: "Связь с вопросами",
    text: "Каждая тема будет ссылаться на вопросы из базы — и наоборот, из вопроса можно будет уйти в теорию.",
  },
];

export default function TheoryPage() {
  return (
    <div className="mx-auto max-w-3xl px-page-x py-12">
      <Meta
        title="Теория"
        description="Раздел в разработке: конспекты по темам, дорожные карты по грейдам и разборы на примерах кода."
        path="/theory"
      />

      <span
        className="inline-flex items-center gap-1.5 rounded-control bg-surface-sunken
                   px-2.5 py-1 text-xs font-medium text-fg-muted"
      >
        <Construction size={14} className="text-accent" />
        Раздел в разработке
      </span>

      <h1 className="mt-4 text-3xl font-semibold tracking-tight">Теория</h1>

      <p className="mt-4 text-base leading-relaxed text-fg-muted">
        Раздел «Теория» сейчас в разработке. Здесь появятся структурированные материалы по
        темам, которые встречаются на технических собеседованиях: не набор отдельных
        вопросов, а последовательные конспекты, которые можно читать подряд.
      </p>

      <p className="mt-3 text-base leading-relaxed text-fg-muted">
        Мы готовим материалы и сверяем их с реальными вопросами из базы, поэтому раздел
        открывается постепенно. Пока он пуст — вся готовая информация лежит в каталоге
        вопросов с разобранными ответами.
      </p>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {PLANNED.map(({ icon: Icon, title, text }) => (
          <div key={title} className="rounded-card border border-border-subtle bg-surface p-5">
            <Icon size={20} className="text-accent" />
            <h2 className="mt-3 font-medium">{title}</h2>
            <p className="mt-1.5 text-sm text-fg-muted">{text}</p>
          </div>
        ))}
      </div>

      <div className="mt-10 rounded-card border border-border-subtle bg-surface-sunken p-5">
        <h2 className="text-sm font-medium">Есть что предложить?</h2>
        <p className="mt-2 text-sm leading-relaxed text-fg-muted">
          Если вам не хватает конкретной темы или вы хотите написать разбор — напишите нам.
          Контакты и формат материалов описаны на странице{" "}
          <Link to="/about" className="text-accent transition-colors hover:underline">
            о проекте
          </Link>
          .
        </p>
      </div>

      <div className="mt-10 flex flex-wrap gap-3">
        <Link to="/questions">
          <Button>Перейти к вопросам</Button>
        </Link>
        <Link to="/levels">
          <Button variant="secondary">Смотреть грейды</Button>
        </Link>
      </div>
    </div>
  );
}
