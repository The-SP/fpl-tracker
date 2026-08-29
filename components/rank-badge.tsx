import { cn } from "@/lib/utils";

interface RankBadgeProps {
  rank: number;
  size?: "sm" | "md";
  className?: string;
}

/**
 * A rank rendered like a shirt number: bold, boxed, tabular digits.
 * Tier is derived purely from the rank itself — gold for top 3, turf green
 * for top 10, neutral otherwise. No extra data needed.
 */
export function RankBadge({ rank, size = "md", className }: RankBadgeProps) {
  const tier = rank <= 3 ? "gold" : rank <= 10 ? "turf" : "neutral";

  const tierStyles = {
    gold: "border-[#B7791F] text-[#8A5A0F] dark:border-[#E4B448] dark:text-[#E4B448]",
    turf: "border-[#1B5E3F] text-[#1B5E3F] dark:border-[#3FA968] dark:text-[#3FA968]",
    neutral:
      "border-[#D8DCD3] text-[#5B6B62] dark:border-[#2A3B31] dark:text-[#8FA095]",
  }[tier];

  const sizeStyles =
    size === "sm"
      ? "h-6 min-w-6 px-1 text-xs"
      : "h-9 min-w-9 px-1.5 text-sm";

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-md border-2 font-mono font-bold tabular-nums leading-none",
        tierStyles,
        sizeStyles,
        className
      )}
    >
      {rank}
    </span>
  );
}
