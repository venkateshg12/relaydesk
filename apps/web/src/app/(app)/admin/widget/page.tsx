"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { AlertTriangle, Check, Loader2 } from "lucide-react";
import {
  contrastWithWhite,
  DEFAULT_BRAND_COLOR,
  isHexColor,
  updateWidgetSettingsSchema,
} from "@repo/types";
import { useWorkspaceSettings } from "@/hooks/admin/useWorkspaceSettings";
import { WidgetPreview } from "@/components/admin/WidgetPreview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

// The shared schema with every field required: the form always sends all four.
const formSchema = updateWidgetSettingsSchema.required();
type FormValues = z.infer<typeof formSchema>;

const PRESET_SWATCHES = [
  { name: "Signal blue", hex: "#2450E6" },
  { name: "Forest green", hex: "#167C52" },
  { name: "Deep violet", hex: "#6E3FF3" },
  { name: "Sunset orange", hex: "#E65100" },
  { name: "Raspberry", hex: "#B8285F" },
  { name: "Teal", hex: "#0D7A82" },
  { name: "Slate", hex: "#334155" },
  { name: "Warm amber", hex: "#B45309" },
];

// Below 3:1 against white the header and launcher are hard to see on a light page (DESIGN_SYSTEM §9).
const MIN_CONTRAST = 3;

export default function WidgetSettingsPage() {
  const { settings, isLoading, update } = useWorkspaceSettings();
  const [previewView, setPreviewView] = useState<"window" | "launcher">(
    "window",
  );
  const [isTeamOnline, setIsTeamOnline] = useState(true);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    mode: "onChange",
    // Loaded settings become the form's saved state; saving updates them, so "dirty" clears by itself.
    values: settings && {
      name: settings.name,
      widgetColor: settings.widgetColor,
      greeting: settings.greeting,
      awayMessage: settings.awayMessage,
    },
  });

  const draft = watch();
  const color = isHexColor(draft.widgetColor ?? "")
    ? draft.widgetColor
    : DEFAULT_BRAND_COLOR;
  const hasLowContrast = contrastWithWhite(color) < MIN_CONTRAST;
  const previewWidget = useMemo(
    () => ({
      workspaceName: draft.name || "Your business",
      widgetColor: color,
      greeting: draft.greeting ?? "",
      awayMessage: draft.awayMessage ?? "",
    }),
    [draft.name, color, draft.greeting, draft.awayMessage],
  );

  const pickColor = (hex: string) =>
    setValue("widgetColor", hex, { shouldDirty: true, shouldValidate: true });

  return (
    <form
      onSubmit={handleSubmit((values) => update.mutate(values))}
      className="space-y-8 pb-24"
    >
      <div>
        <h1 className="font-display text-[30px] leading-[1.05] font-extrabold tracking-[-0.025em] text-foreground font-expanded sm:text-[34px]">
          Widget settings
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          How the chat looks and greets visitors on your website.
        </p>
      </div>

      <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-6">
          <section className="space-y-2 rounded-2xl border border-border bg-card p-6">
            <Label htmlFor="widget-name">Business name</Label>
            <p className="text-xs text-muted-foreground">
              Shown in the chat header and in emails.
            </p>
            {isLoading ? (
              <Skeleton className="h-10 w-full" />
            ) : (
              <Input
                id="widget-name"
                maxLength={100}
                aria-invalid={Boolean(errors.name)}
                {...register("name")}
              />
            )}
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </section>

          <section className="space-y-4 rounded-2xl border border-border bg-card p-6">
            <div className="space-y-1">
              <Label htmlFor="widget-color">Brand colour</Label>
              <p className="text-xs text-muted-foreground">
                The launcher, the header and your visitors&apos; messages. Text
                on top adjusts itself to stay readable.
              </p>
            </div>

            {isLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    aria-label="Pick a colour"
                    value={color}
                    onChange={(event) => pickColor(event.target.value)}
                    className="size-10 shrink-0 cursor-pointer rounded-lg border border-border bg-transparent p-0.5"
                  />
                  <Input
                    id="widget-color"
                    maxLength={7}
                    aria-invalid={Boolean(errors.widgetColor)}
                    className="w-32 font-mono"
                    {...register("widgetColor")}
                  />
                </div>
                {errors.widgetColor && (
                  <p className="text-xs text-destructive">
                    {errors.widgetColor.message}
                  </p>
                )}

                <div
                  className="flex flex-wrap gap-2.5"
                  role="group"
                  aria-label="Preset colours"
                >
                  {PRESET_SWATCHES.map((swatch) => {
                    const isSelected =
                      color.toLowerCase() === swatch.hex.toLowerCase();
                    return (
                      <button
                        key={swatch.hex}
                        type="button"
                        title={swatch.name}
                        aria-label={swatch.name}
                        aria-pressed={isSelected}
                        onClick={() => pickColor(swatch.hex)}
                        className={cn(
                          "flex size-8 items-center justify-center rounded-full border border-border text-white focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                          isSelected &&
                            "ring-2 ring-foreground ring-offset-2 ring-offset-card",
                        )}
                        style={{ backgroundColor: swatch.hex }}
                      >
                        {isSelected && <Check className="size-4" aria-hidden />}
                      </button>
                    );
                  })}
                </div>

                {hasLowContrast && (
                  <p
                    role="status"
                    className="flex items-center gap-2 rounded-lg bg-status-unassigned-soft px-3 py-2 text-xs font-medium text-status-unassigned"
                  >
                    <AlertTriangle className="size-4 shrink-0" aria-hidden />
                    This colour may be hard to see on light pages.
                  </p>
                )}
              </>
            )}
          </section>

          <section className="space-y-2 rounded-2xl border border-border bg-card p-6">
            <Label htmlFor="widget-greeting">Greeting</Label>
            <p className="text-xs text-muted-foreground">
              The first thing a visitor sees when they open the chat.
            </p>
            {isLoading ? (
              <Skeleton className="h-20 w-full" />
            ) : (
              <Textarea
                id="widget-greeting"
                rows={3}
                maxLength={500}
                {...register("greeting")}
              />
            )}
            {errors.greeting && (
              <p className="text-xs text-destructive">
                {errors.greeting.message}
              </p>
            )}
          </section>

          <section className="space-y-2 rounded-2xl border border-border bg-card p-6">
            <Label htmlFor="widget-away">Away message</Label>
            <p className="text-xs text-muted-foreground">
              Shown when nobody on your team is online. It asks for an email so
              you can reply.
            </p>
            {isLoading ? (
              <Skeleton className="h-20 w-full" />
            ) : (
              <Textarea
                id="widget-away"
                rows={3}
                maxLength={500}
                {...register("awayMessage")}
              />
            )}
            {errors.awayMessage && (
              <p className="text-xs text-destructive">
                {errors.awayMessage.message}
              </p>
            )}
          </section>
        </div>

        <aside
          className="space-y-3 rounded-2xl border border-border bg-card p-4 lg:sticky lg:top-6 lg:col-span-6"
          aria-label="Live preview"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-foreground">
              Live preview
            </h2>
            <div className="flex flex-wrap gap-2">
              <Tabs
                value={isTeamOnline ? "online" : "away"}
                onValueChange={(value) => setIsTeamOnline(value === "online")}
              >
                <TabsList>
                  <TabsTrigger value="online" className="px-3 text-xs">
                    Team online
                  </TabsTrigger>
                  <TabsTrigger value="away" className="px-3 text-xs">
                    Team away
                  </TabsTrigger>
                </TabsList>
              </Tabs>
              <Tabs
                value={previewView}
                onValueChange={(value) =>
                  setPreviewView(value as "window" | "launcher")
                }
              >
                <TabsList>
                  <TabsTrigger value="window" className="px-3 text-xs">
                    Chat window
                  </TabsTrigger>
                  <TabsTrigger value="launcher" className="px-3 text-xs">
                    Launcher
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>
          <WidgetPreview
            widget={previewWidget}
            isTeamOnline={isTeamOnline}
            view={previewView}
          />
        </aside>
      </div>

      {isDirty && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card px-4 py-3 animate-in fade-in slide-in-from-bottom-2 duration-200 md:left-[220px]">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
            <p className="text-sm font-medium text-foreground" role="status">
              Unsaved changes
            </p>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => reset()}>
                Discard
              </Button>
              <Button type="submit" disabled={update.isPending}>
                {update.isPending && <Loader2 className="animate-spin" />}
                Save changes
              </Button>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}
