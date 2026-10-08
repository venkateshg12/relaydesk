import Image from "next/image";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

// Screens captured from the running app (light theme) into public/home/ — the product, not a drawing of it.
const SEATS = [
  {
    who: "Your visitor",
    title: "A chat that feels like part of your site.",
    body: "The bubble wears your colour and your name, loads after your page does and never slows it down.",
    points: [
      "Opens with your greeting",
      "Shows when someone is typing",
      "Switches to email when nobody is online",
    ],
    image: {
      src: "/home/seat-widget.png",
      width: 1056,
      height: 1158,
      alt: "The chat widget open on the Sweet Crumbs Bakery site, with a visitor's question and an agent's reply",
    },
    panel:
      "bg-[linear-gradient(150deg,var(--color-signal),var(--color-stage-raised)_85%)]",
    isTall: true,
  },
  {
    who: "Your team",
    title: "One shared inbox, no double replies.",
    body: "New chats land in Unassigned. Whoever takes one owns it, and everyone else sees that at once.",
    points: [
      "Unassigned, Mine, All open and Resolved",
      "Notes only your team can read",
      "Saved replies behind a slash",
    ],
    image: {
      src: "/home/seat-inbox.png",
      width: 2240,
      height: 1520,
      alt: "The agent inbox with a conversation open, the visitor's details on the right and the reply box at the bottom",
    },
    panel:
      "bg-[linear-gradient(150deg,var(--color-pastel-mint),var(--color-presence-online)_95%)]",
    isTall: false,
  },
  {
    who: "You, the owner",
    title: "Run the whole thing from five screens.",
    body: "Pick a colour, write a greeting, invite your team and paste one line. Five numbers tell you how it's going.",
    points: [
      "Live preview while you edit",
      "Invite and remove agents",
      "A plain dashboard, no charts to decode",
    ],
    image: {
      src: "/home/seat-admin.png",
      width: 2240,
      height: 1520,
      alt: "Widget settings in the admin area: business name, brand colour swatches and greeting beside a live preview",
    },
    panel:
      "bg-[linear-gradient(150deg,var(--color-stage-accent),var(--color-status-unassigned-soft)_90%)]",
    isTall: false,
  },
];

// Reference: Discord — every feature is its own stage: a big rounded outer frame, an inner panel with its own
// colour washed across it, the product screen floating inside, and text on the other half, alternating sides.
// Changed: sentence-case headlines, three short facts instead of a paragraph, and the screens are real
// screenshots rather than 3D composites. No mascots.
export function Seats() {
  return (
    <section
      id="seats"
      aria-labelledby="seats-title"
      className="scroll-mt-6 bg-stage py-24 sm:py-32"
    >
      <div className="mx-auto max-w-[1240px] px-4 sm:px-8">
        <h2
          id="seats-title"
          className="max-w-3xl font-display text-[36px] leading-[1] font-extrabold tracking-[-0.025em] text-balance text-stage-foreground font-expanded sm:text-[52px]"
        >
          Three seats at the same conversation.
        </h2>

        <ul className="mt-14 space-y-8 sm:mt-20 sm:space-y-12">
          {SEATS.map((seat, index) => (
            <li
              key={seat.who}
              className="rounded-[36px] bg-stage-foreground/[0.07] p-2 ring-1 ring-stage-line sm:rounded-[48px] sm:p-3"
            >
              <div className="grid grid-cols-1 items-center gap-2 md:grid-cols-2 md:gap-3">
                <div
                  className={cn(
                    "relative flex overflow-hidden rounded-[28px] sm:rounded-[38px]",
                    seat.isTall
                      ? "justify-center px-6 pt-10 sm:px-10 sm:pt-14"
                      : "aspect-[4/3] items-end pt-10 pl-8 sm:pt-14 sm:pl-12",
                    seat.panel,
                    index % 2 === 1 && "md:order-2",
                  )}
                >
                  <Image
                    src={seat.image.src}
                    width={seat.image.width}
                    height={seat.image.height}
                    alt={seat.image.alt}
                    sizes="(min-width: 768px) 600px, 100vw"
                    className={cn(
                      "shadow-widget",
                      seat.isTall
                        ? "h-auto w-full max-w-[380px] rounded-t-2xl"
                        : "h-auto w-full rounded-tl-2xl",
                    )}
                  />
                </div>

                <div className="space-y-5 p-6 sm:p-10 lg:p-14">
                  <p className="text-[15px] font-semibold text-stage-accent">
                    {seat.who}
                  </p>
                  <h3 className="font-display text-[30px] leading-[1.02] font-extrabold tracking-[-0.02em] text-balance text-stage-foreground font-expanded sm:text-[40px]">
                    {seat.title}
                  </h3>
                  <p className="max-w-[44ch] text-[16px] leading-[1.6] text-stage-muted">
                    {seat.body}
                  </p>
                  <ul className="space-y-2.5">
                    {seat.points.map((point) => (
                      <li
                        key={point}
                        className="flex items-center gap-3 text-[15px] text-stage-foreground"
                      >
                        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-stage-foreground/12">
                          <Check className="size-3" aria-hidden />
                        </span>
                        {point}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
