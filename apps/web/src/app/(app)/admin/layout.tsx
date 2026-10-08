"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bookmark, Code, LayoutDashboard, Palette, Users } from "lucide-react";
import { useAppSelector } from "@/store/hooks";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { label: "Widget", href: "/admin/widget", icon: Palette },
  { label: "Install", href: "/admin/install", icon: Code },
  { label: "Saved replies", href: "/admin/saved-replies", icon: Bookmark },
  { label: "Team", href: "/admin/team", icon: Users },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const member = useAppSelector((state) => state.auth.member);
  const router = useRouter();
  const pathname = usePathname();
  const isAdmin = member?.role === "admin";

  // The e-commerce RoleGuardLayout pattern: agents are sent to the inbox before anything renders.
  useEffect(() => {
    if (member && !isAdmin) router.replace("/inbox");
  }, [member, isAdmin, router]);

  if (!isAdmin) return null;

  // A sidebar from 768px up, a scrolling strip of the same links above the page on phones. Like the top bar it
  // sits on the canvas; the current page is a white pill with a hairline (Bumble's active nav pill).
  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] flex-1 flex-col bg-background md:flex-row">
      <nav
        aria-label="Admin"
        className="shrink-0 border-b border-border md:w-[232px] md:border-b-0"
      >
        <ul className="flex gap-1 overflow-x-auto p-2 md:sticky md:top-14 md:flex-col md:p-4">
          {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
            const isActive = pathname === href;
            return (
              <li key={href} className="shrink-0">
                <Link
                  href={href}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-full px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors duration-150 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                    isActive
                      ? "bg-card font-semibold text-foreground ring-1 ring-border"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <Icon className="size-4 shrink-0" aria-hidden />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="min-w-0 flex-1 overflow-y-auto p-4 sm:p-8 lg:p-10">
        <div className="mx-auto max-w-5xl">{children}</div>
      </div>
    </div>
  );
}
