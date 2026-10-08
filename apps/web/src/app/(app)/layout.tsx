"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Inbox, LayoutDashboard, LogOut, User } from "lucide-react";
import AuthLoader from "@/components/auth/AuthLoader";
import { RealtimeBoot } from "@/components/realtime/RealtimeBoot";
import { useAppSelector } from "@/store/hooks";
import { useLogout } from "@/hooks/auth/useLogout";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Logo } from "@/components/brand/Logo";

const initialsOf = (name?: string) =>
  name
    ? name
        .split(" ")
        .map((part) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "?";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { member, workspace } = useAppSelector((state) => state.auth);
  const { mutate: logout } = useLogout();
  const pathname = usePathname();

  // Each page sets its own width: the inbox is full-bleed, admin pages have a sidebar.
  const navItems = [
    { href: "/inbox", label: "Inbox" },
    ...(member?.role === "admin" ? [{ href: "/admin", label: "Admin" }] : []),
  ];

  return (
    <AuthLoader>
      <RealtimeBoot />
      <div className="min-h-screen bg-background flex flex-col">
        {/* The top bar sits on the canvas rather than on a white strip, so the white panels below read as the
            surfaces. Reference: Bumble — a borderless nav where the current page is a white pill. */}
        <header className="sticky top-0 z-40 flex h-14 items-center justify-between gap-3 border-b border-border bg-background/95 px-3 backdrop-blur-sm sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href="/inbox"
              aria-label="RelayDesk inbox"
              className="rounded-lg focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <Logo className="[&>span:last-child]:hidden sm:[&>span:last-child]:inline" />
            </Link>
            {workspace?.name && (
              <span className="max-w-[200px] truncate rounded-full border border-border bg-card px-3 py-1 text-[13px] font-medium text-foreground">
                {workspace.name}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <nav aria-label="Main" className="hidden sm:block">
              <ul className="flex items-center gap-1 rounded-full bg-muted p-1">
                {navItems.map((item) => {
                  const isActive = pathname.startsWith(item.href);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={isActive ? "page" : undefined}
                        className={cn(
                          "block rounded-full px-4 py-1.5 text-sm font-medium transition-colors duration-150 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                          isActive
                            ? "bg-card text-foreground ring-1 ring-border"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" aria-label="Account menu" className="rounded-full focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
                  <Avatar className="h-8 w-8 border border-border">
                    {/* The Google profile photo, for accounts that signed in with Google. Google's image host can
                        refuse requests that carry a referrer, and the initials show until (or instead of) the photo. */}
                    {member?.avatar && (
                      <AvatarImage src={member.avatar} alt="" referrerPolicy="no-referrer" />
                    )}
                    <AvatarFallback className="text-xs font-medium bg-muted text-foreground">
                      {initialsOf(member?.name)}
                    </AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <p className="text-sm font-medium text-foreground truncate">{member?.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{member?.email}</p>
                  <p className="text-xs text-muted-foreground mt-1">{member?.role === "admin" ? "Admin" : "Agent"}</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/inbox">
                    <Inbox className="mr-2 h-4 w-4" />
                    Inbox
                  </Link>
                </DropdownMenuItem>
                {member?.role === "admin" && (
                  <DropdownMenuItem asChild>
                    <Link href="/admin">
                      <LayoutDashboard className="mr-2 h-4 w-4" />
                      Admin
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem asChild>
                  <Link href="/account">
                    <User className="mr-2 h-4 w-4" />
                    My account
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => logout()} className="text-destructive focus:text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="flex-1 flex flex-col">{children}</main>
      </div>
    </AuthLoader>
  );
}
