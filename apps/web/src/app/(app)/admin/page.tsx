"use client";

import { useEffect, useState } from "react";
import {
  CheckCircle2,
  Clock,
  Inbox,
  MessageSquare,
  RefreshCw,
  Users,
} from "lucide-react";
import { useDashboardStats } from "@/hooks/admin/useDashboardStats";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PersonAvatar } from "@/components/inbox/PersonAvatar";
import { StatBlock } from "@/components/admin/StatBlock";

// "42s", "1m 05s": the average first reply as a person would say it.
const formatSeconds = (seconds: number | null) => {
  if (seconds === null) return "—";
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, "0")}s`;
};

// Re-renders every few seconds so "updated 12s ago" stays true.
const useSecondsSince = (timestamp: number) => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(timer);
  }, []);
  return timestamp ? Math.max(0, Math.round((now - timestamp) / 1000)) : null;
};

export default function AdminDashboardPage() {
  const {
    data: stats,
    isLoading,
    isFetching,
    refetch,
    dataUpdatedAt,
  } = useDashboardStats();
  const secondsAgo = useSecondsSince(dataUpdatedAt);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-[30px] leading-[1.05] font-extrabold tracking-[-0.025em] text-foreground font-expanded sm:text-[34px]">
            Dashboard
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Today&apos;s conversations, in your timezone.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {secondsAgo !== null && (
            <span className="text-xs text-muted-foreground tabular-nums">
              {secondsAgo < 5
                ? "Updated just now"
                : `Updated ${secondsAgo}s ago`}
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => void refetch()}
            disabled={isFetching}
          >
            <RefreshCw
              className={
                isFetching
                  ? "animate-spin motion-reduce:animate-none"
                  : undefined
              }
            />
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <StatBlock
          label="Started today"
          value={stats?.startedToday}
          icon={MessageSquare}
          isLoading={isLoading}
        />
        <StatBlock
          label="Open now"
          value={stats?.openNow}
          icon={Inbox}
          isLoading={isLoading}
        />
        <StatBlock
          label="Resolved today"
          value={stats?.resolvedToday}
          icon={CheckCircle2}
          isLoading={isLoading}
        />
        <StatBlock
          label="Avg first reply"
          value={formatSeconds(stats?.avgFirstReplySeconds ?? null)}
          icon={Clock}
          isLoading={isLoading}
        />
        <StatBlock
          label="People online"
          value={stats?.onlineAgentsCount}
          icon={Users}
          isLoading={isLoading}
          className="col-span-2 md:col-span-1"
        />
      </div>

      <section
        className="space-y-4 rounded-2xl border border-border bg-card p-6"
        aria-labelledby="online-now"
      >
        <h2 id="online-now" className="text-base font-semibold text-foreground">
          Online now
        </h2>

        {isLoading ? (
          <div className="space-y-3">
            {[0, 1].map((row) => (
              <div key={row} className="flex items-center gap-3">
                <Skeleton className="size-9 rounded-full" />
                <Skeleton className="h-4 w-32" />
              </div>
            ))}
          </div>
        ) : !stats?.onlineAgents.length ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Nobody is online. Visitors see your away message until someone opens
            RelayDesk.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {stats.onlineAgents.map((agent) => (
              <li key={agent.id} className="flex items-center gap-3 py-3">
                <PersonAvatar id={agent.id} label={agent.name} />
                <span className="flex-1 text-sm font-medium text-foreground">
                  {agent.name}
                </span>
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span
                    className="size-2 rounded-full bg-status-resolved"
                    aria-hidden
                  />
                  Online
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
