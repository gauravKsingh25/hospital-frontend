import { cn } from "@/lib/utils";

/**
 * The pieces every Reports tab is built from.
 *
 * Presentational only — no state, no handlers. The heavy lifting (sorting the
 * doctors table, switching tabs) lives in the few client components that need
 * it; everything here is a `div` with a width or a short inline SVG, so the
 * dashboard adds next to nothing to the bundle. The one real chart (footfall
 * by day) stays behind `next/dynamic`, as CLAUDE.md §4 asks.
 */

/** A section of a tab, with a heading a screen reader can navigate by. */
export function Section({
  id,
  title,
  hint,
  action,
  children,
}: {
  id: string;
  title: string;
  hint?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="space-y-3" data-testid="report-section" data-section={id}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div>
          <h2 id={id} className="font-medium">
            {title}
          </h2>
          {hint ? <p className="text-muted-foreground text-sm">{hint}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

/**
 * A card inside a section: a small heading, a muted line saying what the
 * numbers are, and the content. The reports equivalent of a Panel with a
 * lighter header — a dashboard has many of these side by side, and a band
 * across each would turn the page into stripes.
 */
export function Card({
  title,
  hint,
  action,
  className,
  children,
  testId,
}: {
  title: string;
  hint?: string;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
  testId?: string;
}) {
  return (
    <div
      className={cn("bg-card shadow-panel min-w-0 rounded-xl border p-4", className)} // restyle: inline — a report card
      data-testid={testId}
    >
      <div className="mb-3 flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold">{title}</h3>
          {hint ? <p className="text-muted-foreground mt-0.5 text-xs">{hint}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

export type Tone = "default" | "good" | "warn" | "bad" | "muted";

const VALUE_TONES: Record<Tone, string> = {
  default: "",
  good: "text-success",
  warn: "text-caution-foreground",
  bad: "text-destructive",
  muted: "text-muted-foreground",
};

/**
 * One number, and the words that stop it being misread.
 *
 * `hint` is not decoration. "Received" and "Billed" are different numbers
 * that look identical on a tile, and a manager who adds them together has
 * double-counted the hospital's month.
 *
 * `trend` draws a sparkline beside the value when there is a daily series
 * behind the number — only footfall has one today, so most tiles go without.
 * There is deliberately no "▲ 4%" chip: the API does not return the previous
 * period, and a comparison the screen made up would be worse than none.
 */
export function Kpi({
  label,
  value,
  hint,
  tone = "default",
  trend,
  testId,
}: {
  label: string;
  value: string;
  hint?: React.ReactNode;
  tone?: Tone;
  trend?: number[];
  testId?: string;
}) {
  return (
    <div
      className="bg-card shadow-panel flex min-w-0 flex-col gap-1 rounded-xl border px-4 pt-3.5 pb-3" // restyle: inline — a KPI tile
      data-testid={testId}
    >
      <dt className="text-muted-foreground truncate text-[13px] font-medium">{label}</dt>
      <div className="flex items-end justify-between gap-2">
        <dd className={cn("tabular truncate text-2xl font-semibold tracking-tight", VALUE_TONES[tone])}>
          {value}
        </dd>
        {trend && trend.length > 1 ? <Sparkline values={trend} /> : null}
      </div>
      {hint ? <p className="text-muted-foreground text-xs">{hint}</p> : null}
    </div>
  );
}

/** A row of KPI tiles. A `<dl>`, so each label is announced with its number. */
export function KpiGrid({ children, columns = 4 }: { children: React.ReactNode; columns?: 3 | 4 }) {
  return (
    <dl
      className={cn(
        "grid grid-cols-1 gap-3 min-[420px]:grid-cols-2",
        columns === 3 ? "lg:grid-cols-3" : "lg:grid-cols-4",
      )}
    >
      {children}
    </dl>
  );
}

/**
 * A tiny trend line. Inline SVG rather than a Recharts chart: twenty points
 * and a dot do not justify loading a chart library onto the first paint.
 * Hidden from screen readers — it repeats the number beside it as a shape.
 */
export function Sparkline({ values }: { values: number[] }) {
  const width = 88;
  const height = 28;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const points = values.map((value, index) => {
    const x = (index / (values.length - 1)) * (width - 4) + 2;
    const y = height - 3 - ((value - min) / range) * (height - 6);
    return [x, y] as const;
  });
  const last = points[points.length - 1];

  return (
    <svg
      aria-hidden
      viewBox={`0 0 ${width} ${height}`}
      className="text-chart-1 h-7 w-[88px] shrink-0"
    >
      <polyline
        points={points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ")}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinejoin="round"
        opacity={0.85}
      />
      {last ? <circle cx={last[0]} cy={last[1]} r={2.6} fill="currentColor" /> : null}
    </svg>
  );
}

const CHIP_TONES = {
  good: "bg-success/12 text-success",
  warn: "bg-caution/20 text-caution-foreground",
  bad: "bg-destructive/10 text-destructive",
  muted: "bg-muted text-muted-foreground",
} as const;

/** A status word on its own tint. Always a word, never colour alone. */
export function Chip({
  tone,
  children,
}: {
  tone: keyof typeof CHIP_TONES;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap",
        CHIP_TONES[tone],
      )}
    >
      {children}
    </span>
  );
}

/** The empty state a card shows when the window genuinely held nothing. */
export function NothingYet({ message }: { message: string }) {
  return (
    <p className="text-muted-foreground rounded-xl border border-dashed bg-card px-4 py-8 text-center text-sm">{/* restyle: inline — empty state */}
      {message}
    </p>
  );
}
