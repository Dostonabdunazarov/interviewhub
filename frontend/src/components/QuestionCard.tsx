import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Eye, MessageSquare, Star } from "lucide-react";
import { Badge } from "./ui/Badge";
import { CompanyLogo } from "./ui/CompanyLogo";
import { DifficultyDots } from "./ui/DifficultyDots";
import { formatCount } from "../lib/utils";
import type { QuestionListItem } from "../types/api";

/** Сколько логотипов компаний влезает в карточку до «+N». */
const MAX_COMPANIES = 3;

export function QuestionCard({ question, index = 0 }: { question: QuestionListItem; index?: number }) {
  const extraCompanies = question.companies.length - MAX_COMPANIES;

  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      // Лесенка появления, но не бесконечная: на 20-й карточке задержка
      // уже раздражала бы, поэтому потолок в 8 позиций.
      transition={{ duration: 0.25, delay: Math.min(index, 8) * 0.04 }}
      className="group relative rounded-card border border-border-subtle bg-surface p-5
                 transition-colors hover:border-border-strong"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-base font-medium leading-snug">
          <Link
            to={`/questions/${question.slug}`}
            className="transition-colors after:absolute after:inset-0 group-hover:text-accent"
          >
            {question.title}
          </Link>
        </h3>
        {question.isFeatured && (
          <Star size={16} className="mt-0.5 shrink-0 fill-warning text-warning" aria-label="Избранное" />
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Badge color={question.category.color}>{question.category.name}</Badge>
        <Badge color={question.level.color}>{question.level.name}</Badge>
        <DifficultyDots value={question.difficulty} />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-fg-muted">
        {question.companies.length > 0 && (
          <div className="flex items-center gap-1">
            {question.companies.slice(0, MAX_COMPANIES).map((c) => (
              <CompanyLogo key={c.id} company={c} className="size-6 text-[10px]" />
            ))}
            {extraCompanies > 0 && <span className="ml-0.5">+{extraCompanies}</span>}
          </div>
        )}

        <span className="flex items-center gap-1">
          <MessageSquare size={13} />
          {question.answerCount}
        </span>
        <span className="flex items-center gap-1">
          <Eye size={13} />
          {formatCount(question.viewCount)}
        </span>
      </div>
    </motion.article>
  );
}
