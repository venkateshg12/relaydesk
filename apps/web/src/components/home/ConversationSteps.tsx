import { Check, Code2, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";

// A chat bubble drawn the way the product draws them (DESIGN_SYSTEM §8): incoming white with a hairline,
// outgoing tinted. Used only for the small scenes on these cards.
function Bubble({
  children,
  side,
}: {
  children: React.ReactNode;
  side: "in" | "out";
}) {
  return (
    <p
      className={cn(
        "w-fit max-w-[85%] rounded-3xl px-3.5 py-2 text-[13px] leading-snug",
        side === "in"
          ? "rounded-bl-md border border-border bg-card text-foreground"
          : "ml-auto rounded-br-md bg-signal text-white dark:text-stage",
      )}
    >
      {children}
    </p>
  );
}

function SceneInstall() {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 rounded-xl bg-stage px-3 py-2.5 font-mono text-[11px] text-stage-muted">
        <Code2 className="size-3.5 shrink-0" aria-hidden />
        <span className="truncate">
          &lt;script async src=&quot;…/loader.js&quot;{" "}
          <span className="text-stage-accent">data-key</span>=…&gt;
        </span>
      </div>
      <div className="flex items-center justify-end gap-3">
        <span className="text-[12px] text-muted-foreground">
          Every page, bottom right
        </span>
        <span className="flex size-11 items-center justify-center rounded-full bg-signal text-white shadow-widget dark:text-stage">
          <MessageCircle className="size-5" aria-hidden />
        </span>
      </div>
    </div>
  );
}

function SceneVisitor() {
  return (
    <div className="space-y-2">
      <Bubble side="in">Hi, how can we help?</Bubble>
      <Bubble side="out">Do you deliver to Gajuwaka?</Bubble>
      <p className="text-right text-[11px] text-muted-foreground tabular-nums">
        Sent just now
      </p>
    </div>
  );
}

function SceneInbox() {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 rounded-xl bg-signal-soft px-3 py-2.5">
        <span className="flex size-8 items-center justify-center rounded-full bg-avatar-4 text-[11px] font-semibold text-foreground">
          V
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-foreground">
            Visitor 1042
          </p>
          <p className="truncate text-[12px] text-foreground">
            Do you deliver to Gajuwaka?
          </p>
        </div>
        <span className="rounded-full bg-signal px-1.5 text-[11px] font-semibold text-white tabular-nums dark:text-stage">
          1
        </span>
      </div>
      <div className="flex justify-end">
        <span className="rounded-lg bg-primary px-3 py-1.5 text-[12px] font-medium text-primary-foreground">
          Assign to me
        </span>
      </div>
    </div>
  );
}

function SceneReply() {
  return (
    <div className="space-y-2">
      <p className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
        <span className="flex gap-0.5" aria-hidden>
          <span className="size-1.5 animate-typing-dot rounded-full bg-signal" />
          <span className="size-1.5 animate-typing-dot rounded-full bg-signal [animation-delay:150ms]" />
          <span className="size-1.5 animate-typing-dot rounded-full bg-signal [animation-delay:300ms]" />
        </span>
        Priya is typing…
      </p>
      <Bubble side="in">Yes! We deliver there from 9 to 1 on Sundays.</Bubble>
      <p className="flex justify-end">
        <span className="inline-flex items-center gap-1 rounded-full bg-status-resolved-soft px-2.5 py-0.5 text-[12px] font-medium text-status-resolved">
          <Check className="size-3" aria-hidden />
          Resolved
        </span>
      </p>
    </div>
  );
}

// The 13 steps from docs/PRODUCT_GUIDE.md, grouped into the four moments a business owner would describe.
const STEPS = [
  {
    range: "Steps 1–2",
    title: "Paste one line",
    body: "Sign up, name your business and paste the snippet into your site. A chat bubble appears in the corner of every page.",
    tint: "bg-pastel-sky",
    Scene: SceneInstall,
  },
  {
    range: "Steps 3–5",
    title: "A visitor asks",
    body: "They open the bubble, see your greeting and ask their question. It shows in their window straight away.",
    tint: "bg-pastel-peach",
    Scene: SceneVisitor,
  },
  {
    range: "Steps 6–8",
    title: "Your team picks it up",
    body: "It lands at the top of Unassigned with a sound. One click on “Assign to me” and everyone else sees it’s taken.",
    tint: "bg-pastel-lilac",
    Scene: SceneInbox,
  },
  {
    range: "Steps 9–13",
    title: "Answer, then resolve",
    body: "The visitor sees you typing, your reply arrives instantly, and Resolve files it away. If they write next week, it reopens with the history.",
    tint: "bg-pastel-mint",
    Scene: SceneReply,
  },
];

// Reference: Turn.io (docs/design-references/turn-io.md) — rooms of pastel colour, 24px cards with no border
// or shadow, a pill tag in the card's own tone, and a white product card holding a messenger-style scene.
// Changed: our four pastels (the avatar palette) instead of Turn's six, and display type at 28px rather than
// Turn's 69px+, because the four cards share the space.
export function ConversationSteps() {
  return (
    <section
      id="how"
      aria-labelledby="how-title"
      className="scroll-mt-6 bg-background py-24 sm:py-32"
    >
      <div className="mx-auto max-w-[1240px] px-4 sm:px-8">
        <div className="max-w-2xl space-y-4">
          <h2
            id="how-title"
            className="font-display text-[36px] leading-[1] font-extrabold tracking-[-0.025em] text-balance text-foreground font-expanded sm:text-[52px]"
          >
            One conversation, start to finish.
          </h2>
          <p className="max-w-[56ch] text-[17px] leading-[1.55] text-muted-foreground">
            Every feature exists to make these thirteen steps work, from the
            first line of code to a chat that reopens a week later.
          </p>
        </div>

        <ol className="mt-12 grid grid-cols-1 gap-4 sm:mt-16 md:grid-cols-2 md:gap-5">
          {STEPS.map(({ range, title, body, tint, Scene }) => (
            <li
              key={title}
              className={cn(
                "flex min-w-0 flex-col justify-between gap-8 rounded-4xl p-6 sm:p-8",
                tint,
              )}
            >
              <div className="space-y-3">
                <span className="inline-block rounded-full bg-card/70 px-3 py-1 text-[12px] font-semibold text-foreground">
                  {range}
                </span>
                <h3 className="font-display text-[28px] leading-[1.1] font-bold tracking-[-0.02em] text-foreground">
                  {title}
                </h3>
                <p className="max-w-[46ch] text-[15px] leading-[1.55] text-foreground/80">
                  {body}
                </p>
              </div>
              <div className="rounded-2xl bg-card p-4 sm:p-5">
                <Scene />
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
