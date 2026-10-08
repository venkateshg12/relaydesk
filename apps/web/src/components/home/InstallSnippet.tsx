import Link from "next/link";
import { CopyButton } from "@/components/admin/CopyButton";
import { Button } from "@/components/ui/button";
import { WIDGET_ORIGIN } from "@/lib/env";

const SNIPPET_KEY = "your-public-key";

// The same line `/admin/install` hands out, with a placeholder where the workspace's key goes.
const snippet = `<script async src="${WIDGET_ORIGIN}/loader.js" data-key="${SNIPPET_KEY}"></script>`;

// A real sequence, so numbered steps are right here.
const STEPS = [
  "Create a workspace and name your business.",
  "Paste the line just before </body> on every page.",
  "Pick your colour and greeting. The bubble updates on its own.",
];

// Reference: Kippo (docs/design-references/kippo.md) — the terminal block: a dark panel drawn by a 1px light
// border, monospace text, and one rationed hot accent. Changed: it's a single card on a light section rather
// than a black page, the accent is the stage's honey instead of pink, and nothing is set in caps.
export function InstallSnippet() {
  return (
    <section
      id="install"
      aria-labelledby="install-title"
      className="scroll-mt-6 bg-card py-24 sm:py-32"
    >
      <div className="mx-auto grid max-w-[1240px] grid-cols-1 items-center gap-12 px-4 sm:px-8 lg:grid-cols-[5fr_7fr] lg:gap-16">
        <div className="space-y-6">
          <h2
            id="install-title"
            className="font-display text-[36px] leading-[1] font-extrabold tracking-[-0.025em] text-balance text-foreground font-expanded sm:text-[52px]"
          >
            Add it with one line.
          </h2>
          <p className="max-w-[46ch] text-[17px] leading-[1.55] text-muted-foreground">
            The loader is 1.9 kB (0.9 kB gzipped), has no dependencies and waits
            for your page to finish loading before it does anything.
          </p>
          <ol className="space-y-3">
            {STEPS.map((step, index) => (
              <li key={step} className="flex gap-4 text-[15px] text-foreground">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-foreground text-[13px] font-semibold tabular-nums">
                  {index + 1}
                </span>
                <span className="pt-0.5">{step}</span>
              </li>
            ))}
          </ol>
          <Button asChild size="lg">
            <Link href="/signup">Create a workspace</Link>
          </Button>
        </div>

        <div className="rounded-[20px] bg-stage p-2">
          <div className="rounded-[14px] border border-stage-foreground/70">
            <div className="flex items-center justify-between gap-3 border-b border-stage-line px-4 py-3">
              <span className="font-mono text-[13px] text-stage-muted">
                index.html
              </span>
              <div className="[&_button]:border-stage-line [&_button]:bg-transparent [&_button]:text-stage-foreground [&_button:hover]:bg-stage-foreground/10 [&_button:hover]:text-stage-foreground">
                <CopyButton text={snippet} />
              </div>
            </div>
            <pre className="overflow-x-auto px-4 py-6 font-mono text-[13px] leading-[1.9] text-stage-muted sm:px-6 sm:text-[14px]">
              <code>
                <span>&lt;!-- …your page… --&gt;</span>
                {"\n"}
                <span className="text-stage-foreground">&lt;script</span> async
                src=&quot;{WIDGET_ORIGIN}/loader.js&quot;
                {"\n"}
                {"        "}data-key=&quot;
                <span className="text-stage-accent">{SNIPPET_KEY}</span>
                &quot;<span className="text-stage-foreground">&gt;&lt;/script&gt;</span>
                {"\n"}
                <span className="text-stage-foreground">&lt;/body&gt;</span>
              </code>
            </pre>
          </div>
        </div>
      </div>
    </section>
  );
}
