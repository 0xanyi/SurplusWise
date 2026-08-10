import { cn } from "@/lib/utils";

const sizes = {
  sm: { mark: "h-7 w-[1.05rem]", word: "text-base" },
  md: { mark: "h-[30px] w-[1.125rem]", word: "text-lg" },
  lg: { mark: "h-9 w-[1.35rem]", word: "text-xl" },
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
        <svg viewBox="0 0 196 326" className="size-full" focusable="false">
          <path
            className="fill-[#111318] dark:fill-[#F5F1E8]"
            d="M126 0v102l-53 24C42 140 8 124 8 94 8 72 22 57 44 47L126 0Z"
          />
          <path fill="#2B6BF3" d="M167 42l21-9v91l-86 13-26-7 91-36V42Z" />
          <path
            className="stroke-background"
            fill="#2B6BF3"
            strokeWidth="7"
            strokeLinejoin="round"
            d="M136 19l22-10v93l-89 39-8-16 75-33V19Z"
          />
          <path fill="#2B6BF3" d="M8 186l84 8-62 26v43L8 273v-87Z" />
          <path
            className="fill-[#111318] dark:fill-[#F5F1E8]"
            d="M40 232l44-21c29-13 58-12 79 7 20 18 18 46 3 62-9 10-19 15-33 21l-93 25v-94Z"
          />
          <path
            className="fill-background stroke-background"
            strokeWidth="8"
            strokeLinejoin="round"
            d="M8 94c10 15 26 23 47 28l77 18c36 8 56 28 56 55v30c-11-18-28-29-53-35l-81-18C24 165 8 150 8 128V94Z"
          />
          <path
            fill="#B58A3A"
            d="M8 94c10 15 26 23 47 28l77 18c36 8 56 28 56 55v30c-11-18-28-29-53-35l-81-18C24 165 8 150 8 128V94Z"
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
