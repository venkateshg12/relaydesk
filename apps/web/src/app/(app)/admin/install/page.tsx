"use client";

import { ExternalLink } from "lucide-react";
import { useWorkspaceSettings } from "@/hooks/admin/useWorkspaceSettings";
import { TEST_SITE_ORIGIN, WIDGET_ORIGIN } from "@/lib/env";
import { Skeleton } from "@/components/ui/skeleton";
import { buttonVariants } from "@/components/ui/button";
import { CopyButton } from "@/components/admin/CopyButton";
import { cn } from "@/lib/utils";

function Step({
  number,
  title,
  action,
  children,
}: {
  number: number;
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card p-6">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-foreground">
          {number}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export default function InstallWidgetPage() {
  const { settings, isLoading } = useWorkspaceSettings();
  const publicKey = settings?.publicKey ?? "";

  const snippet = `<script async src="${WIDGET_ORIGIN}/loader.js" data-key="${publicKey}"></script>`;
  // The sample page loads the widget with this workspace's own key, so what they see is their widget.
  const testUrl = `${TEST_SITE_ORIGIN}/index.html?key=${encodeURIComponent(publicKey)}`;

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h1 className="font-display text-[30px] leading-[1.05] font-extrabold tracking-[-0.025em] text-foreground font-expanded sm:text-[34px]">
          Install the widget
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          One line on your site puts the chat bubble on every page.
        </p>
      </div>

      <div className="space-y-6">
        <Step
          number={1}
          title="Copy the snippet"
          action={<CopyButton text={snippet} disabled={isLoading} />}
        >
          <p className="text-sm text-muted-foreground">
            Paste it before the closing{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
              &lt;/body&gt;
            </code>{" "}
            tag of every page that should show the chat. It waits for the page
            to finish loading, so it never slows it down.
          </p>
          {isLoading ? (
            <Skeleton className="h-14 w-full rounded-lg" />
          ) : (
            <pre className="overflow-x-auto rounded-lg border border-border bg-muted/40 p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap break-all text-foreground select-all">
              {snippet}
            </pre>
          )}
        </Step>

        <Step
          number={2}
          title="Your public key"
          action={
            <CopyButton
              text={publicKey}
              label="Copy key"
              variant="ghost"
              disabled={isLoading}
            />
          }
        >
          <p className="text-sm text-muted-foreground">
            It identifies your workspace and is safe to publish — it is already
            in the snippet.
          </p>
          {isLoading ? (
            <Skeleton className="h-10 w-full rounded-lg" />
          ) : (
            <p className="rounded-lg border border-border bg-muted/40 px-3.5 py-2.5 font-mono text-xs text-foreground select-all">
              {publicKey}
            </p>
          )}
        </Step>

        <Step number={3} title="Try it">
          <p className="text-sm text-muted-foreground">
            Open a sample site with your widget on it, send a message, and
            answer it from your inbox. If your own site sets a content security
            policy, allow{" "}
            <span className="font-mono text-xs text-foreground">
              {WIDGET_ORIGIN}
            </span>{" "}
            in{" "}
            <span className="font-mono text-xs text-foreground">frame-src</span>
            .
          </p>
          <a
            href={testUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              !publicKey && "pointer-events-none opacity-50",
            )}
          >
            <ExternalLink />
            Open the sample site
          </a>
        </Step>
      </div>
    </div>
  );
}
