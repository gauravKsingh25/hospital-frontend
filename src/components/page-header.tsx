import { cn } from "@/lib/utils";

/**
 * A screen's title: the one `<h1>` style in the app. `PageHeader` uses it; a
 * screen whose header row has its own layout (a search box, a row of
 * actions) uses it directly, so the title still matches every other screen.
 */
export function PageTitle({ className, ...props }: React.ComponentProps<"h1">) {
  return <h1 className={cn("text-xl font-medium tracking-tight", className)} {...props} />;
}

/**
 * The top of every screen (Frost and slate): the title, a muted line under it,
 * and the screen's actions on the right. Below the `sm` breakpoint the actions
 * wrap under the title, so a phone never scrolls sideways to reach them.
 *
 * Page titles go through here and nowhere else, so every screen's title has
 * the same size, weight and spacing (`src/lib/style-guard.test.mjs`).
 */
export function PageHeader({
  title,
  subtitle,
  actions,
  className,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header
      data-slot="page-header"
      className={cn("flex flex-wrap items-start justify-between gap-x-4 gap-y-3", className)}
    >
      <div className="min-w-0">
        <PageTitle>{title}</PageTitle>
        {subtitle ? <p className="text-muted-foreground mt-0.5 text-sm">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
