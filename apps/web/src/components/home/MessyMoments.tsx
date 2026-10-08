import {
  Building2,
  CopyCheck,
  ListOrdered,
  UserCheck,
  WifiOff,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

// The five situations from docs/PRODUCT_GUIDE.md ("Rules and tricky situations") a business owner cares about
// most. The other eight are listed as chips underneath.
const RULES: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: ListOrdered,
    title: "Everyone sees the same order",
    body: "Two messages sent at almost the same moment appear in the same order for the visitor and for every agent.",
  },
  {
    icon: WifiOff,
    title: "Nothing lost when the internet drops",
    body: "Anything typed while offline is sent when the connection returns. Nothing goes missing, nothing appears twice.",
  },
  {
    icon: CopyCheck,
    title: "Press send twice, get one message",
    body: "A double click or a retry never turns into a duplicate on either side.",
  },
  {
    icon: UserCheck,
    title: "One agent per chat",
    body: "When two agents click “Assign to me” at the same moment, exactly one gets it and the other is told who.",
  },
  {
    icon: Building2,
    title: "Your conversations stay yours",
    body: "Many businesses share the app. Each team only ever sees its own business’s data.",
  },
];

const MORE = [
  "Two tabs stay in step",
  "Notes never reach the visitor",
  "Offline replies go by email",
  "Removed agents lose access at once",
  "A resolved chat reopens with its history",
  "A closed inbox keeps the chat yours",
  "Floods are rate limited",
  "Never slows the host page",
];

// Reference: Handshake (docs/design-references/handshake.md) — black on white, one oversized headline used
// once on the page, soft 24px cards with a hairline and no shadow, and fully rounded chips. Changed: the
// headline is sentence case in our display face, and there is no lime: the icons sit in a neutral tile.
export function MessyMoments() {
  return (
    <section
      id="rules"
      aria-labelledby="rules-title"
      className="scroll-mt-6 bg-card py-24 sm:py-32"
    >
      <div className="mx-auto max-w-[1240px] px-4 sm:px-8">
        <h2
          id="rules-title"
          className="font-display text-[52px] leading-[0.88] font-extrabold tracking-[-0.035em] text-foreground font-expanded sm:text-[96px] lg:text-[128px]"
        >
          Built for the
          <br />
          messy moments.
        </h2>
        <p className="mt-8 max-w-[58ch] text-[17px] leading-[1.55] text-muted-foreground">
          A chat demo works when everything goes right. These are the thirteen
          things that go wrong in real life, and what RelayDesk does about each
          one.
        </p>

        <ul className="mt-14 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
          {RULES.map(({ icon: Icon, title, body }, index) => (
            <li
              key={title}
              className={cn(
                "rounded-4xl border border-border p-6 sm:p-8",
                index < 2 ? "lg:col-span-3" : "lg:col-span-2",
              )}
            >
              <span className="flex size-11 items-center justify-center rounded-xl bg-muted text-foreground">
                <Icon className="size-5" aria-hidden />
              </span>
              <h3 className="mt-6 text-[20px] leading-[1.25] font-semibold tracking-[-0.01em] text-foreground">
                {title}
              </h3>
              <p className="mt-2 text-[15px] leading-[1.55] text-muted-foreground">
                {body}
              </p>
            </li>
          ))}
        </ul>

        <div className="mt-10">
          <h3 className="text-[15px] font-semibold text-foreground">
            And eight more
          </h3>
          <ul className="mt-4 flex flex-wrap gap-2">
            {MORE.map((item) => (
              <li
                key={item}
                className="rounded-full border border-foreground/70 px-4 py-2 text-[14px] text-foreground"
              >
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
