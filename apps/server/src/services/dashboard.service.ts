import type { DashboardStats } from "@repo/types";
import { orm, pool } from "../config/db.js";
import { presence } from "../realtime/presence.js";
import { cache } from "../utils/cache/index.js";

const NUMBERS_CACHE_TTL_SECONDS = 30;

type Numbers = Omit<DashboardStats, "onlineAgentsCount" | "onlineAgents">;

/*
  The four numbers from Postgres in one round trip, cached for 30 s per workspace and timezone.
  "Today" starts at midnight in the admin's timezone, worked out by Postgres itself —
  `date_trunc('day', now() AT TIME ZONE tz) AT TIME ZONE tz` — so daylight-saving and half-hour offsets
  are right (turning the local date into a UTC midnight, as this used to, is hours off outside UTC).
 */
const getNumbers = async (workspaceId: string, timezone: string): Promise<Numbers> =>
    cache.getOrSet(
        await cache.versionedKey(["dashboard"], `${workspaceId}:${timezone}`),
        async () => {
            const { rows } = await pool.query(
                `WITH bounds AS (SELECT date_trunc('day', now() AT TIME ZONE $2) AT TIME ZONE $2 AS today)
                 SELECT COUNT(*) FILTER (WHERE c."createdAt" >= b.today)::int AS "startedToday",
                        COUNT(*) FILTER (WHERE c."status" <> 'resolved')::int AS "openNow",
                        COUNT(*) FILTER (WHERE c."resolvedAt" >= b.today)::int AS "resolvedToday",
                        AVG(EXTRACT(EPOCH FROM (c."firstAgentReplyAt" - c."createdAt")))
                            FILTER (WHERE c."createdAt" >= b.today AND c."firstAgentReplyAt" IS NOT NULL)::float AS "avgFirstReplySeconds"
                   FROM "public"."conversation" c, bounds b
                  WHERE c."workspaceId" = $1`,
                [workspaceId, timezone]
            );
            const row = rows[0];
            return {
                startedToday: row.startedToday,
                openNow: row.openNow,
                resolvedToday: row.resolvedToday,
                // No reply yet today is "no number", not "0 seconds".
                avgFirstReplySeconds: row.avgFirstReplySeconds === null ? null : Math.round(row.avgFirstReplySeconds),
            };
        },
        NUMBERS_CACHE_TTL_SECONDS
    );

export const getDashboardStatsService = async (workspaceId: string, timezone: string): Promise<DashboardStats> => {
    const numbers = await getNumbers(workspaceId, timezone);

    // Who is online is read fresh from the presence hash — a name that lingers for 30 s would be a lie.
    const { members } = await presence.snapshot(workspaceId);
    const onlineIds = Object.keys(members).filter((id) => members[id] === "online");
    const onlineAgents = onlineIds.length
        ? await orm.Member.where({ workspaceId, status: "active" })
              .where((member) => member.id.in(onlineIds))
              .select("id", "name")
              .all()
        : [];

    return { ...numbers, onlineAgentsCount: onlineAgents.length, onlineAgents };
};
