import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { REPO_URL } from "@/lib/env";

const COLUMNS = [
  {
    title: "Product",
    links: [
      { href: "#demo", label: "Live demo" },
      { href: "#how", label: "How it works" },
      { href: "#rules", label: "Guarantees" },
      { href: "#install", label: "Install" },
      { href: "#faq", label: "FAQ" },
    ],
  },
  {
    title: "Account",
    links: [
      { href: "/login", label: "Log in" },
      { href: "/signup", label: "Create a workspace" },
      { href: "/inbox", label: "Open the inbox" },
    ],
  },
  ...(REPO_URL
    ? [{ title: "Project", links: [{ href: REPO_URL, label: "View the code" }] }]
    : []),
];

// Reference: Discord — the closing line set huge and centred ("You can't scroll anymore. Better go chat."),
// one white button, then a link grid with no dividers and the brand name filling the full width at the very
// bottom. Changed: our own line, sentence case, and the wordmark is decorative (hidden from screen readers).
export function HomeFooter() {
  return (
    <footer className="relative isolate overflow-hidden bg-stage text-stage-foreground">
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_80%_50%_at_50%_100%,color-mix(in_oklch,var(--color-signal)_60%,transparent),transparent_75%)]"
      />

      <div className="mx-auto max-w-[1240px] px-4 pt-28 pb-20 text-center sm:px-8 sm:pt-36">
        <h2 className="mx-auto max-w-[18ch] font-display text-[40px] leading-[0.95] font-extrabold tracking-[-0.03em] text-balance font-expanded sm:text-[64px] lg:text-[76px]">
          That&apos;s the whole page. Go answer someone.
        </h2>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Button
            asChild
            size="lg"
            className="h-12 rounded-xl bg-stage-foreground px-6 text-[15px] text-stage hover:bg-stage-foreground/90"
          >
            <Link href="/inbox">Open the full inbox</Link>
          </Button>
          <Button
            asChild
            variant="outline"
            size="lg"
            className="h-12 rounded-xl border-stage-foreground/40 bg-transparent px-6 text-[15px] text-stage-foreground hover:bg-stage-foreground/10 hover:text-stage-foreground dark:border-stage-foreground/40 dark:bg-transparent"
          >
            <Link href="/signup">Add it to your site</Link>
          </Button>
        </div>
      </div>

      <div className="mx-auto grid max-w-[1240px] grid-cols-2 gap-10 border-t border-stage-line px-4 py-14 sm:px-8 md:grid-cols-[2fr_repeat(3,1fr)]">
        <div className="col-span-2 space-y-4 md:col-span-1">
          <Logo tone="stage" />
          <p className="max-w-[34ch] text-[15px] leading-[1.6] text-stage-muted">
            Live chat for small businesses: one line of code on your site, one
            shared inbox for your team.
          </p>
        </div>
        {COLUMNS.map((column) => (
          <nav key={column.title} aria-label={column.title}>
            <h3 className="text-[14px] font-medium text-stage-muted">
              {column.title}
            </h3>
            <ul className="mt-4 space-y-2.5">
              {column.links.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="rounded text-[15px] text-stage-foreground transition-colors duration-150 hover:text-stage-accent focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>

      <p
        aria-hidden
        className="-mb-[0.18em] px-2 text-center font-display text-[13vw] leading-[0.9] font-extrabold tracking-[-0.045em] whitespace-nowrap text-stage-foreground/90 select-none font-expanded sm:-mb-[0.16em]"
      >
        RelayDesk
      </p>
    </footer>
  );
}
