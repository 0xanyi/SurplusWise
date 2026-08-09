import { cn } from "@/lib/utils";

interface PageHeaderProps {
  /** Small uppercase line above the title — usually the sidebar group. */
  kicker: string;
  title: string;
  /** Optional supporting line below the title. */
  description?: string;
  /** Buttons, filters, or a period picker, right-aligned on desktop. */
  actions?: React.ReactNode;
  className?: string;
}

/**
 * The kicker answers "where am I" so the h1 does not have to, which is what
 * lets the title stay short and large.
 */
export function PageHeader({
  kicker,
  title,
  description,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        "flex flex-col items-stretch justify-between gap-4 sm:flex-row sm:items-end",
        className
      )}
    >
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-[0.06em] text-muted-foreground">
          {kicker}
        </p>
        <h1 className="mt-1.5 font-display text-[25px] font-semibold leading-[1.1] tracking-[-0.025em] sm:text-[31px]">
          {title}
        </h1>
        {description && (
          <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && (
        <div className="flex flex-none items-center gap-2">{actions}</div>
      )}
    </header>
  );
}
