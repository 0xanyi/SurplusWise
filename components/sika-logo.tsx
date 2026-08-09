import { cn } from "@/lib/utils";

const sizes = {
  sm: { tile: "size-7 rounded-lg", glyph: "text-sm", word: "text-base" },
  md: { tile: "size-[30px] rounded-[9px]", glyph: "text-base", word: "text-lg" },
  lg: { tile: "size-9 rounded-xl", glyph: "text-lg", word: "text-xl" },
};

interface SikaLogoProps {
  size?: keyof typeof sizes;
  /** Hide the wordmark and show the tile alone. */
  markOnly?: boolean;
  className?: string;
}

/**
 * The mint tile is the one place Sika Mint touches a solid fill. It is
 * identity, not a money figure — see the Mint-Is-Chrome Rule in DESIGN.md.
 */
export function SikaLogo({ size = "md", markOnly = false, className }: SikaLogoProps) {
  const s = sizes[size];
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <span
        className={cn(
          "flex flex-none items-center justify-center bg-brand text-brand-foreground",
          s.tile
        )}
      >
        <span className={cn("font-display font-semibold leading-none", s.glyph)}>S</span>
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
