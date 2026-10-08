import { z } from "zod";

export const updateWidgetSettingsSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100, "Name is too long").optional(),
  widgetColor: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "Color must be a 6-character hex code (e.g. #2450E6)")
    .optional(),
  greeting: z.string().trim().max(500, "Greeting is too long").optional(),
  awayMessage: z.string().trim().max(500, "Away message is too long").optional(),
});

export type UpdateWidgetSettingsSchema = z.infer<typeof updateWidgetSettingsSchema>;

// The admin's browser timezone ("Asia/Kolkata"), which decides where "today" starts. Anything the
// platform doesn't know falls back to UTC rather than failing the dashboard.
const isTimeZone = (value: string) => {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
};

export const dashboardQuerySchema = z.object({
  tz: z.string().max(64).refine(isTimeZone).catch("UTC"),
});
export type DashboardQuery = z.infer<typeof dashboardQuerySchema>;

export interface DashboardStats {
  startedToday: number;
  openNow: number;
  resolvedToday: number;
  avgFirstReplySeconds: number | null;
  onlineAgentsCount: number;
  onlineAgents: Array<{ id: string; name: string }>;
}
