import { formatCount, shareOf } from "@/features/reports/format";

/**
 * The two non-list shapes the Reports tabs use: a single bar split into
 * shares, and a funnel. Both are plain markup — the figures are printed next
 * to every shape, so nothing here depends on a tooltip being hovered.
 */

/** The chart palette, in its validated order. Tokens, so dark mode follows. */
export const SERIES = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
] as const;

export type Share = { key: string; label: string; value: number; display: string };

/**
 * One bar, split into its parts, with a legend that carries every number.
 *
 * Used for "how it was paid": the parts add up to the whole, which is the one
 * case a part-of-whole bar reads better than a ranked list. Percentages are
 * for display only — the amounts themselves come from the server untouched.
 */
export function StackBar({ parts, label, testId }: { parts: Share[]; label: string; testId?: string }) {
  const total = parts.reduce((sum, part) => sum + Math.max(0, part.value), 0);

  return (
    <div data-testid={testId}>
      <div aria-hidden className="bg-muted flex h-7 gap-0.5 overflow-hidden rounded-lg">
        {parts.map((part, index) =>
          part.value > 0 ? (
            <div
              key={part.key}
              className="h-full min-w-[3px]"
              style={{ flexGrow: part.value, background: SERIES[index % SERIES.length] }}
              title={`${part.label}: ${part.display}`}
            />
          ) : null,
        )}
      </div>
      <ul aria-label={label} className="mt-3 grid gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
        {parts.map((part, index) => (
          <li key={part.key} className="flex min-w-0 items-center gap-2">
            <i
              aria-hidden
              className="size-2.5 shrink-0 rounded-[3px]"
              style={{ background: SERIES[index % SERIES.length] }}
            />
            <span className="text-muted-foreground min-w-0 truncate">{part.label}</span>
            <span className="tabular ml-auto shrink-0 font-semibold">{part.display}</span>
            <span className="tabular text-muted-foreground w-10 shrink-0 text-right text-xs">
              {total > 0 ? `${Math.round((part.value / total) * 100)}%` : "—"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export type FunnelStep = { key: string; label: string; value: number };

/**
 * How many visits made it to each step. Each bar is scaled against the first
 * step, and the right-hand column says what share of the *previous* step got
 * through — that is where a leak shows up.
 */
export function Funnel({
  steps,
  ofPrevious,
  testId,
}: {
  steps: FunnelStep[];
  ofPrevious: string;
  testId?: string;
}) {
  const first = steps[0]?.value ?? 0;

  return (
    <ol className="space-y-2" data-testid={testId}>
      {steps.map((step, index) => {
        const previous = index > 0 ? steps[index - 1]?.value ?? 0 : 0;
        return (
          <li
            key={step.key}
            className="grid grid-cols-[minmax(0,7.5rem)_minmax(0,1fr)_3.5rem] items-center gap-3"
          >
            <span className="text-sm leading-tight font-medium">{step.label}</span>
            <div className="bg-muted h-8 overflow-hidden rounded-md">
              <div
                className="bg-primary text-primary-foreground tabular flex h-full min-w-11 items-center rounded-md px-2.5 text-sm font-semibold"
                style={{ width: shareOf(step.value, first), opacity: 1 - index * 0.14 }}
              >
                {formatCount(step.value)}
              </div>
            </div>
            <span className="text-muted-foreground text-right text-xs leading-tight">
              {index > 0 && previous > 0 ? (
                <>
                  <b className="text-foreground tabular block text-sm">
                    {Math.round((step.value / previous) * 100)}%
                  </b>
                  {ofPrevious}
                </>
              ) : null}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
