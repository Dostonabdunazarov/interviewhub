import { Link } from "react-router-dom";
import { ArrowUpRight, BookOpen, Building2, Layers, Mail, Search, Send } from "lucide-react";
import { useStats } from "../lib/hooks";
import { Button } from "../components/ui/Button";
import { formatCount } from "../lib/utils";
import { Meta } from "../components/Meta";

const FEATURES = [
  {
    icon: Layers,
    title: "По грейдам и категориям",
    text: "Один вопрос живёт сразу в нескольких осях: направление, грейд, компании и свободные теги.",
  },
  {
    icon: Building2,
    title: "По компаниям",
    text: "Видно, где и на каком этапе задавали вопрос — Google, Яндекс, Ozon и другие.",
  },
  {
    icon: Search,
    title: "Полнотекстовый поиск",
    text: "Ищет по заголовкам, постановкам и тексту ответов, с учётом русской морфологии.",
  },
  {
    icon: BookOpen,
    title: "Разобранные ответы",
    text: "Не список тем, а объяснения с примерами кода. У вопроса может быть короткий и развёрнутый ответ.",
  },
];

const CONTACTS = [
  {
    icon: Send,
    label: "Telegram",
    value: "@hypex_s",
    href: "https://t.me/hypex_s",
    hint: "Быстрее всего — обычно отвечаю в тот же день",
  },
  {
    icon: Mail,
    label: "Email",
    value: "hypexsystems@mail.ru",
    href: "mailto:hypexsystems@mail.ru",
    hint: "Удобно, если вопросов сразу много или нужен файл",
  },
];

/** Что прислать, чтобы вопрос сразу можно было добавить в базу. */
const CONTRIBUTION = [
  "Сам вопрос — в той формулировке, в которой его задали.",
  "Направление и грейд: например «PostgreSQL, middle».",
  "Ответ или хотя бы тезисы — разберём и оформим вместе.",
  "Компанию и этап собеседования, если помните: это самое ценное.",
];

export default function AboutPage() {
  const { data } = useStats();

  return (
    <div className="mx-auto max-w-3xl px-page-x py-12">
      <Meta
        title="О проекте"
        description="InterviewHub — база вопросов с реальных технических собеседований и разобранных ответов к ним."
        path="/about"
      />

      <h1 className="text-3xl font-semibold tracking-tight">О проекте</h1>

      <p className="mt-4 text-base leading-relaxed text-fg-muted">
        InterviewHub — это база вопросов с реальных технических собеседований и разобранных
        ответов к ним. Читать можно без регистрации: аккаунты нужны только тем, кто наполняет
        базу.
      </p>

      {data && (
        <p className="mt-3 text-sm text-fg-subtle">
          Сейчас в базе {formatCount(data.totalQuestions)} опубликованных вопросов в{" "}
          {formatCount(data.totalCategories)} категориях и {formatCount(data.totalCompanies)}{" "}
          компаниях.
        </p>
      )}

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {FEATURES.map(({ icon: Icon, title, text }) => (
          <div key={title} className="rounded-card border border-border-subtle bg-surface p-5">
            <Icon size={20} className="text-accent" />
            <h2 className="mt-3 font-medium">{title}</h2>
            <p className="mt-1.5 text-sm text-fg-muted">{text}</p>
          </div>
        ))}
      </div>

      <section className="mt-10">
        <h2 className="text-xl font-semibold tracking-tight">Как пользоваться</h2>
        <ol className="mt-4 flex flex-col gap-3 text-sm text-fg-muted">
          <li className="flex gap-3">
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-surface-sunken
                             text-xs font-medium text-fg">
              1
            </span>
            Выберите категорию и грейд — или сразу компанию, в которую готовитесь.
          </li>
          <li className="flex gap-3">
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-surface-sunken
                             text-xs font-medium text-fg">
              2
            </span>
            Прочитайте вопрос и попробуйте ответить сами: ответы спрятаны под кнопкой не просто так.
          </li>
          <li className="flex gap-3">
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-surface-sunken
                             text-xs font-medium text-fg">
              3
            </span>
            Раскройте разбор и сверьтесь — там же примеры кода и подводные камни.
          </li>
        </ol>
      </section>

      <section className="mt-12">
        <h2 className="text-xl font-semibold tracking-tight">Хотите добавить вопрос?</h2>

        <p className="mt-4 text-sm leading-relaxed text-fg-muted">
          База растёт за счёт тех, кто недавно проходил собеседования. Если вам достался
          вопрос, которого здесь нет, — напишите. Особенно ценны вопросы с указанием
          компании и этапа: по ним видно, к чему готовиться в конкретном месте, а не
          «вообще по .NET».
        </p>

        <p className="mt-3 text-sm leading-relaxed text-fg-muted">
          Готовый разбор присылать не обязательно. Достаточно формулировки — ответ напишем
          и оформим сами, а вас укажем в благодарностях, если захотите. Правки к
          существующим ответам тоже приветствуются: если нашли неточность или устаревшую
          деталь, это стоит целого нового вопроса.
        </p>

        <div className="mt-6 rounded-card border border-border-subtle bg-surface-sunken p-5">
          <h3 className="text-sm font-medium">Что приложить к письму</h3>
          <ul className="mt-3 flex flex-col gap-2">
            {CONTRIBUTION.map((item) => (
              <li key={item} className="flex gap-2.5 text-sm text-fg-muted">
                {/* Маркер точкой, а не list-disc: так он выравнивается по
                    первой строке при переносе текста. */}
                <span
                  aria-hidden="true"
                  className="mt-1.5 size-1.5 shrink-0 rounded-full bg-accent"
                />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {CONTACTS.map(({ icon: Icon, label, value, href, hint }) => (
            <a
              key={label}
              href={href}
              // Telegram уводит на внешний домен; у mailto: rel не мешает.
              target={href.startsWith("http") ? "_blank" : undefined}
              rel={href.startsWith("http") ? "noreferrer" : undefined}
              className="group flex items-start gap-3 rounded-card border border-border-subtle
                         bg-surface p-5 transition-colors hover:border-border-strong"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-control
                               bg-surface-sunken text-accent">
                <Icon size={18} />
              </span>

              <span className="min-w-0">
                <span className="flex items-center gap-1 text-xs text-fg-subtle">
                  {label}
                  <ArrowUpRight
                    size={12}
                    className="opacity-0 transition-opacity group-hover:opacity-100"
                  />
                </span>
                {/* break-all: длинный адрес не должен растягивать карточку. */}
                <span className="mt-0.5 block break-all font-medium transition-colors
                                 group-hover:text-accent">
                  {value}
                </span>
                <span className="mt-1 block text-xs text-fg-muted">{hint}</span>
              </span>
            </a>
          ))}
        </div>
      </section>

      <div className="mt-10 flex flex-wrap gap-3">
        <Link to="/questions">
          <Button>Начать подготовку</Button>
        </Link>
        <Link to="/companies">
          <Button variant="secondary">Смотреть компании</Button>
        </Link>
      </div>
    </div>
  );
}
