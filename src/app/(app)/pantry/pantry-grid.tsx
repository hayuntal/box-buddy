"use client";

import { useOptimistic, useTransition } from "react";
import { setPantryItem } from "@/app/actions";
import { Card } from "@/components/ui";
import type { Availability, Category } from "@/lib/domain";

type Item = { slug: string; displayName: string; category: Category };
type Stocked = Record<string, Availability | undefined>;

const SECTIONS: { category: Category; label: string }[] = [
  { category: "base", label: "לחמים ובסיסים" },
  { category: "spread", label: "ממרחים" },
  { category: "protein", label: "מילויים" },
  { category: "side", label: "תוספות, פירות וירקות" },
];

/** אין → יש → הולך ונגמר → אין: פקד אחד, שלושה מצבים, בלי תפריטים. */
function next(current: Availability | undefined): Availability | null {
  if (current === undefined || current === "out") return "plenty";
  if (current === "plenty") return "low";
  return null;
}

export function PantryGrid({ items, stocked }: { items: Item[]; stocked: Stocked }) {
  const [, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useOptimistic(
    stocked,
    (state: Stocked, update: { slug: string; availability: Availability | null }) => ({
      ...state,
      [update.slug]: update.availability ?? undefined,
    }),
  );

  const toggle = (slug: string) => {
    const availability = next(optimistic[slug]);
    startTransition(async () => {
      setOptimistic({ slug, availability });
      await setPantryItem(slug, availability);
    });
  };

  return (
    <div className="space-y-4">
      {SECTIONS.map((section) => {
        const sectionItems = items.filter((i) => i.category === section.category);
        if (sectionItems.length === 0) return null;

        return (
          <Card key={section.category}>
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-ink-soft">
              {section.label}
            </h2>
            <ul className="flex flex-wrap gap-2">
              {sectionItems.map((item) => {
                const state = optimistic[item.slug];
                const styles =
                  state === "plenty"
                    ? "border-box bg-box text-white"
                    : state === "low"
                      ? "border-warn/40 bg-warn/10 text-warn"
                      : "border-ink/15 bg-white/60 text-ink-soft";

                return (
                  <li key={item.slug}>
                    <button
                      type="button"
                      onClick={() => toggle(item.slug)}
                      aria-pressed={state !== undefined}
                      className={`min-h-11 rounded-full border px-3.5 text-sm font-semibold transition-colors ${styles}`}
                    >
                      {item.displayName}
                      {state === "low" ? " · נגמר" : ""}
                    </button>
                  </li>
                );
              })}
            </ul>
          </Card>
        );
      })}
    </div>
  );
}
