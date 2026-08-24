import { useState } from "react";
import { cn, initials } from "../../lib/utils";
import type { Company, CompanyRef } from "../../types/api";

interface CompanyLogoProps {
  company: Pick<Company | CompanyRef, "name" | "logoUrl" | "color">;
  className?: string;
}

/**
 * Логотип компании с буквенной заглушкой. Фолбэк нужен в двух случаях:
 * LogoUrl пуст (часть компаний в сидинге намеренно без логотипа) либо
 * внешняя картинка не загрузилась — файлы мы не храним, ссылки живут своей жизнью.
 */
export function CompanyLogo({ company, className }: CompanyLogoProps) {
  const [failed, setFailed] = useState(false);
  const showImage = company.logoUrl && !failed;

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden",
        "size-8 rounded-control text-xs font-semibold",
        !showImage && "border border-border-subtle",
        className,
      )}
      style={
        !showImage && company.color
          ? {
              color: company.color,
              backgroundColor: `color-mix(in oklab, ${company.color} 16%, transparent)`,
              borderColor: `color-mix(in oklab, ${company.color} 32%, transparent)`,
            }
          : undefined
      }
      title={company.name}
    >
      {showImage ? (
        <img
          src={company.logoUrl!}
          alt={company.name}
          className="size-full object-contain"
          loading="lazy"
          onError={() => setFailed(true)}
        />
      ) : (
        initials(company.name)
      )}
    </span>
  );
}
