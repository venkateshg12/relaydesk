import { format, isToday, isYesterday } from "date-fns";
import type { VisitorSummary } from "@repo/types";

// "Visitor 1042" when they haven't given a name (PRODUCT_GUIDE, inbox list).
export const visitorLabel = (
  visitor: Pick<VisitorSummary, "name" | "displayNo">,
) => visitor.name || `Visitor ${visitor.displayNo}`;

export const initialsOf = (label: string) =>
  label
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

// Stable 0–5 from an id, so the same person always gets the same avatar colour.
export const avatarIndexOf = (id: string) => {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return Math.abs(hash) % 6;
};

// Day separators in the timeline: "Today", "Yesterday", "12 Mar".
export const dayLabel = (date: Date) => {
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  return format(date, "d MMM");
};
