"use client";

import { cn } from "@/lib/utils";

/**
 * A row of filter buttons — the console's lists filter by a handful of
 * states, and five large buttons beat a dropdown that hides four of them.
 */
export function FilterTabs<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="bg-muted inline-flex flex-wrap gap-1 rounded-lg p-1"
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            "min-h-tap rounded-md px-3 text-sm font-medium transition-colors",
            "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
            value === option.value
              ? "bg-background text-foreground shadow-panel"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
