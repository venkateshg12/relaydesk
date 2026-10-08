import type { LucideIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// One plain number (DESIGN_SYSTEM §5, stat size): tabular figures, no chart, no gradient. The figure uses the
// display face, the way the homepage's measured numbers do (Heynds: a flat block, the number does the work).
export function StatBlock({
  label,
  value,
  icon: Icon,
  isLoading,
  className,
}: {
  label: string;
  value: React.ReactNode;
  icon: LucideIcon;
  isLoading: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col justify-between gap-6 rounded-2xl border border-border bg-card p-6",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3 text-muted-foreground">
        <span className="text-[13px] font-medium">{label}</span>
        <span className="flex size-8 items-center justify-center rounded-lg bg-muted text-foreground">
          <Icon className="size-4" aria-hidden />
        </span>
      </div>
      {isLoading ? (
        <Skeleton className="h-10 w-20" />
      ) : (
        <div className="font-display text-[26px] leading-none font-extrabold tracking-[-0.03em] whitespace-nowrap text-foreground tabular-nums sm:text-[36px]">
          {value}
        </div>
      )}
    </div>
  );
}
