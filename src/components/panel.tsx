import { cn } from "@/lib/utils";

/**
 * The one bordered box in the app (Frost and slate).
 *
 * Every section of a screen sits in a Panel: white, a thin cool border, 12px
 * corners and the single faint shadow the theme allows. Screens used to draw
 * their own `rounded-lg border` boxes, each a little different; putting the
 * look here means one answer for "what does a section look like", and
 * `src/lib/style-guard.test.mjs` keeps screens from drawing their own again.
 *
 * Presentational only: no state, no data, no effects.
 */
export function Panel({ className, ...props }: React.ComponentProps<"section">) {
  return (
    <section
      data-slot="panel"
      className={cn("bg-card text-card-foreground shadow-panel overflow-hidden rounded-xl border", className)}
      {...props}
    />
  );
}

/**
 * The strip across the top of a panel: a title, an optional count (set in the
 * mono face, so counts line up across panels) and optional actions.
 */
export function PanelHeader({
  title,
  count,
  actions,
  className,
}: {
  title: React.ReactNode;
  count?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      data-slot="panel-header"
      className={cn("bg-band flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1 border-b px-4 py-2", className)}
    >
      <h2 className="text-foreground text-sm font-medium">{title}</h2>
      {count !== undefined && count !== null ? (
        <span className="tabular text-muted-foreground ml-auto text-sm">{count}</span>
      ) : null}
      {actions ? (
        <div className={cn("flex flex-wrap items-center gap-2", count == null && "ml-auto")}>{actions}</div>
      ) : null}
    </div>
  );
}

/** The padded content area of a panel. */
export function PanelBody({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="panel-body" className={cn("p-4", className)} {...props} />;
}
