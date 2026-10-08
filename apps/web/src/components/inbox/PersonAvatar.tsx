import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { avatarIndexOf, initialsOf } from "./format";

// Full class names (not built strings) so Tailwind keeps them. Never blue: blue is for live signals.
const AVATAR_BACKGROUNDS = [
  "bg-avatar-1",
  "bg-avatar-2",
  "bg-avatar-3",
  "bg-avatar-4",
  "bg-avatar-5",
  "bg-avatar-6",
];

export function PersonAvatar({
  id,
  label,
  className,
}: {
  id: string;
  label: string;
  className?: string;
}) {
  return (
    <Avatar className={cn("size-9", className)}>
      <AvatarFallback
        className={cn(
          "text-xs font-medium text-foreground",
          AVATAR_BACKGROUNDS[avatarIndexOf(id)],
        )}
      >
        {initialsOf(label)}
      </AvatarFallback>
    </Avatar>
  );
}
