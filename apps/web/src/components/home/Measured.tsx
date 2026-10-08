// The only numbers on this page, copied from README.md "Measured" (`pnpm --filter server load`).
const NUMBERS = [
  { value: "1,000", label: "messages sent, 1,000 acknowledged" },
  { value: "0", label: "errors" },
  { value: "15 ms", label: "median delivery (p50)" },
  { value: "92 ms", label: "95th percentile" },
  { value: "397 ms", label: "99th percentile" },
];

// Reference: Heynds (docs/design-references/heynds.md) — a centred heading over a flat row, columns split by
// 1px hairlines instead of cards, small 4px badge, almost no shadow. Changed: no orange and no two-tone
// headline; the environment sits right under the figures so nobody reads them as a hosted benchmark.
export function Measured() {
  return (
    <section
      aria-labelledby="measured-title"
      className="border-t border-border bg-background py-24 sm:py-28"
    >
      <div className="mx-auto max-w-[1240px] px-4 sm:px-8">
        <div className="mx-auto max-w-2xl space-y-4 text-center">
          <span className="inline-block rounded-sm border border-border bg-card px-2 py-0.5 text-[12px] font-medium text-muted-foreground">
            Load test, one local instance
          </span>
          <h2
            id="measured-title"
            className="font-display text-[36px] leading-[1] font-extrabold tracking-[-0.025em] text-foreground font-expanded sm:text-[52px]"
          >
            Measured, not promised.
          </h2>
        </div>

        {/* A 1px gap over a hairline-coloured grid draws every divider, whatever the column count. */}
        <dl className="mt-14 grid grid-cols-2 gap-px overflow-hidden border-y border-border bg-border lg:grid-cols-5">
          {NUMBERS.map(({ value, label }) => (
            <div
              key={label}
              className="flex flex-col-reverse justify-end gap-2 bg-background px-4 py-8 last:col-span-2 sm:px-6 lg:last:col-span-1"
            >
              <dt className="text-[14px] leading-snug text-muted-foreground">
                {label}
              </dt>
              <dd className="font-display text-[32px] leading-none font-extrabold tracking-[-0.03em] whitespace-nowrap text-foreground tabular-nums font-expanded sm:text-[40px]">
                {value}
              </dd>
            </div>
          ))}
        </dl>

        <p className="mx-auto mt-8 max-w-[70ch] text-center text-[14px] leading-[1.6] text-muted-foreground">
          100 visitors each sent 10 messages one second apart while 5 agents
          received everything: one API instance, a local PostgreSQL 16, Linux
          and Node 22. That is the rate of this run, not the ceiling, and it has
          not been measured on a hosted instance yet.
        </p>
      </div>
    </section>
  );
}
