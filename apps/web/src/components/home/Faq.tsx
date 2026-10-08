import { ChevronDown } from "lucide-react";

// Answers come from docs/PRODUCT_GUIDE.md only.
const QUESTIONS = [
  {
    question: "Will it work on my website?",
    answer:
      "If you can paste one line of HTML, yes. The widget runs inside its own frame and loads after your page does, so it can't clash with your styles or slow your site down.",
  },
  {
    question: "What happens when nobody is online?",
    answer:
      "The widget switches to offline mode and asks the visitor for their email. Your reply goes to them by email.",
  },
  {
    question: "Can visitors ever see our internal notes?",
    answer:
      "No. Notes are stored apart from messages and are never sent to a visitor in any form. In the inbox they look like yellow sticky notes, so nobody mixes them up.",
  },
  {
    question: "What if two of us answer the same chat?",
    answer:
      "You can't. The first click on “Assign to me” wins, and the other person is told who has it.",
  },
  {
    question: "What if a visitor's connection drops mid-chat?",
    answer:
      "Whatever they type is queued and sent when the connection comes back. Nothing is lost and nothing arrives twice.",
  },
  {
    question: "What does it cost?",
    answer:
      "Version 1 has no paid plans or billing. Create a workspace and use it.",
  },
];

// Reference: Bumble (docs/design-references/bumble.md) — one warm yellow as a full-bleed band (never a
// button), near-black ink for every word, soft 24px white cards with the single whisper shadow, left-aligned
// prose. Changed: the cards are native <details> disclosures, so they open with the keyboard and need no
// script; the chevron turning is the only motion.
export function Faq() {
  return (
    <section
      id="faq"
      aria-labelledby="faq-title"
      className="scroll-mt-6 bg-honey py-24 sm:py-32"
    >
      <div className="mx-auto grid max-w-[1240px] grid-cols-1 gap-10 px-4 sm:px-8 lg:grid-cols-[5fr_7fr] lg:gap-16">
        <div className="space-y-4">
          <h2
            id="faq-title"
            className="font-display text-[36px] leading-[1] font-extrabold tracking-[-0.025em] text-balance text-foreground font-expanded sm:text-[52px]"
          >
            Questions owners ask.
          </h2>
          <p className="max-w-[36ch] text-[17px] leading-[1.55] text-foreground/80">
            Short answers, straight from how the product is built.
          </p>
        </div>

        <ul className="space-y-3">
          {QUESTIONS.map(({ question, answer }) => (
            <li key={question}>
              <details className="group rounded-3xl bg-card shadow-whisper open:pb-1">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-3xl px-6 py-5 text-[17px] font-semibold tracking-[0.005em] text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none [&::-webkit-details-marker]:hidden">
                  {question}
                  <ChevronDown
                    className="size-5 shrink-0 transition-transform duration-200 ease-out group-open:rotate-180"
                    aria-hidden
                  />
                </summary>
                <p className="max-w-[60ch] px-6 pb-5 text-[16px] leading-[1.6] text-muted-foreground">
                  {answer}
                </p>
              </details>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
