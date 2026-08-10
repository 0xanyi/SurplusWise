import { cn } from "@/lib/utils";

const sizes = {
  sm: { mark: "h-7 w-[1.4rem]", word: "text-base" },
  md: { mark: "h-[30px] w-6", word: "text-lg" },
  lg: { mark: "h-9 w-[1.8rem]", word: "text-xl" },
};

interface SikaLogoProps {
  size?: keyof typeof sizes;
  /** Hide the wordmark and show the symbol alone. */
  markOnly?: boolean;
  className?: string;
}

export function SikaLogo({ size = "md", markOnly = false, className }: SikaLogoProps) {
  const s = sizes[size];
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <span
        className={cn("flex flex-none items-center justify-center", s.mark)}
        role={markOnly ? "img" : undefined}
        aria-label={markOnly ? "Sika" : undefined}
        aria-hidden={markOnly ? undefined : true}
      >
        <svg viewBox="0 0 128 160" className="size-full" focusable="false">
          <path
            className="fill-[#111318] dark:fill-[#F5F1E8]"
            d="M12 25C12 11 23 0 38 0h38v29H43c-7 0-12 4-12 11 0 5 3 9 9 12l22 8-14 24-20-8C18 72 12 62 12 50V25Z"
          />
          <path fill="#2B6BF3" d="M70 59V20h14v28l10 4V10h14v60L70 59Z" />
          <path fill="#2B6BF3" d="M58 101v39H44v-28l-10-4v42H20V90l38 11Z" />
          <path
            className="fill-[#111318] dark:fill-[#F5F1E8]"
            d="M116 135c0 14-11 25-26 25H52v-29h33c7 0 12-4 12-11 0-5-3-9-9-12l-22-8 14-24 20 8c10 4 16 14 16 26v25Z"
          />
          <path
            fill="#B58A3A"
            d="M12 56c18 11 31 16 52 20 24 4 38 12 52 23v16c-17-13-30-19-53-23-24-4-38-11-51-20V56Z"
          />
        </svg>
      </span>
      {!markOnly && (
        <span
          className={cn(
            "font-display font-semibold tracking-[-0.02em] text-foreground",
            s.word
          )}
        >
          Sika
        </span>
      )}
    </span>
  );
}
