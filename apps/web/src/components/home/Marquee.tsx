import { LogoMark } from "@/components/brand/Logo";

// What an agent actually does all day, in the order a conversation goes.
const WORDS = ["Reply", "Assign", "Leave a note", "Resolve", "Reconnect", "Catch up"];

// Reference: Discord — the full-width band of giant words separated by the brand mark, scrolling sideways.
// Changed: sentence case, our own verbs, and it stops for reduced motion (the global rule cuts the animation)
// and pauses on hover. The list is rendered twice so the loop has no seam; the copy is hidden from screen
// readers, which read the list once.
export function Marquee() {
  const row = (isCopy: boolean) => (
    <ul
      aria-hidden={isCopy || undefined}
      className="flex shrink-0 items-center gap-10 pr-10 sm:gap-14 sm:pr-14"
    >
      {WORDS.map((word) => (
        <li key={word} className="flex items-center gap-10 sm:gap-14">
          <span className="font-display text-[40px] leading-none font-extrabold tracking-[-0.02em] whitespace-nowrap text-stage-foreground font-expanded sm:text-[64px]">
            {word}
          </span>
          <LogoMark className="size-9 sm:size-11" />
        </li>
      ))}
    </ul>
  );

  return (
    <section
      aria-label="What your team does in RelayDesk"
      className="overflow-hidden border-y border-stage-line bg-stage-raised py-7 sm:py-9"
    >
      <div className="flex w-max animate-marquee hover:[animation-play-state:paused]">
        {row(false)}
        {row(true)}
      </div>
    </section>
  );
}
