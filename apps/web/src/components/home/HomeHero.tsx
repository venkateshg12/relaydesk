import Link from "next/link";
import { Code2 } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { REPO_URL } from "@/lib/env";
import { HomeDemo } from "./HomeDemo";

const NAV_LINKS = [
  { href: "#how", label: "How it works" },
  { href: "#seats", label: "Who sees what" },
  { href: "#rules", label: "Guarantees" },
  { href: "#install", label: "Install" },
  { href: "#faq", label: "FAQ" },
];

// Reference: Discord (docs/design-references/discord.md) — a deep indigo stage instead of a page, a dense
// heavy headline on the left, a white filled button paired with an outlined one, and the product composite as
// the hero. Changed for RelayDesk: sentence case instead of all caps, the composite is the *live* demo rather
// than a picture, and it sits in Discord's nested feature frame that straddles the stage and the canvas below.
export function HomeHero() {
  return (
    <div className="relative isolate">
      {/* The stage: indigo night with a blue glow from the top right and a faint field of dots. It stops
          partway down the demo frame, so the frame bridges the dark hero and the light page. */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 -z-10 h-[calc(100%-220px)] overflow-hidden bg-stage"
      >
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_85%_0%,color-mix(in_oklch,var(--color-signal)_55%,transparent),transparent_70%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(var(--color-stage-line)_1px,transparent_1px)] [mask-image:linear-gradient(to_bottom,black,transparent_85%)] bg-size-[28px_28px]" />
      </div>

      <header className="mx-auto flex h-20 max-w-[1240px] items-center justify-between gap-4 px-4 sm:px-8">
        <Link
          href="/"
          aria-label="RelayDesk home"
          className="rounded-lg focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <Logo tone="stage" />
        </Link>
        <nav aria-label="Sections" className="hidden lg:block">
          <ul className="flex items-center gap-1">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  className="rounded-lg px-3 py-2 text-[15px] font-medium text-stage-foreground/85 transition-colors duration-150 hover:bg-stage-foreground/10 hover:text-stage-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex items-center gap-2">
          <Button
            asChild
            variant="ghost"
            size="lg"
            className="hidden text-stage-foreground hover:bg-stage-foreground/10 hover:text-stage-foreground sm:inline-flex"
          >
            <Link href="/login">Log in</Link>
          </Button>
          <Button
            asChild
            size="lg"
            className="rounded-xl bg-stage-foreground text-stage hover:bg-stage-foreground/90"
          >
            <Link href="/signup">Add it to your site</Link>
          </Button>
        </div>
      </header>

      <div className="mx-auto max-w-[1240px] px-4 pt-8 pb-10 sm:px-8 sm:pt-12 lg:pb-14">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[7fr_5fr] lg:items-end lg:gap-16">
          <h1 className="max-w-[12ch] font-display text-[44px] leading-[0.92] font-extrabold tracking-[-0.025em] text-balance text-stage-foreground font-expanded sm:text-[64px] lg:text-[76px]">
            Type on the left. Answer on the right.
          </h1>
          <div className="space-y-6 lg:pb-2">
            <p className="max-w-[42ch] text-[17px] leading-[1.55] text-stage-muted">
              RelayDesk is live chat for small businesses: a bubble on your
              website and one shared inbox for your team. The demo below is the
              real product, in a private workspace that deletes itself. No
              sign-up.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button
                asChild
                size="lg"
                className="h-12 rounded-xl bg-stage-foreground px-6 text-[15px] text-stage hover:bg-stage-foreground/90"
              >
                <Link href="/inbox">Open the full inbox</Link>
              </Button>
              {REPO_URL && (
                <Button
                  asChild
                  variant="outline"
                  size="lg"
                  className="h-12 rounded-xl border-stage-foreground/40 bg-transparent px-6 text-[15px] text-stage-foreground hover:bg-stage-foreground/10 hover:text-stage-foreground dark:border-stage-foreground/40 dark:bg-transparent"
                >
                  <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
                    <Code2 />
                    View the code
                  </a>
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Discord's feature frame: a translucent outer ring around a solid inner panel. */}
      <div id="demo" className="mx-auto max-w-[1400px] scroll-mt-6 px-2 sm:px-6">
        <div className="rounded-[36px] bg-stage-foreground/10 p-2 ring-1 ring-stage-line backdrop-blur-sm sm:rounded-[44px] sm:p-3">
          <div className="rounded-[28px] bg-card p-3 shadow-float sm:rounded-[34px] sm:p-5">
            <HomeDemo />
          </div>
        </div>
      </div>
    </div>
  );
}
