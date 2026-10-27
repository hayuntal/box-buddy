import { getIngredient } from "@/lib/catalog";
import type { InventoryEntry, PlanEntry } from "@/lib/domain";

/**
 * Aggregates what the household needs to buy for a generated plan: the
 * ingredients a plan consumes that are low or out, plus the suggestions from
 * any child whose plan could not be built at all.
 */

export type ShoppingItem = {
  slug: string;
  displayName: string;
  reason: "running_low" | "out_of_stock" | "needed_for_shortfall";
  /** How many plan entries call for it, as a rough quantity hint. */
  timesNeeded: number;
  /** Ticked off by the parent while shopping. */
  checked?: boolean;
};

const REASON_ORDER: Record<ShoppingItem["reason"], number> = {
  needed_for_shortfall: 0,
  out_of_stock: 1,
  running_low: 2,
};

export function buildShoppingList(
  entries: readonly PlanEntry[],
  inventory: readonly InventoryEntry[],
): readonly ShoppingItem[] {
  const availability = new Map(inventory.map((i) => [i.slug, i.availability]));
  const counts = new Map<string, number>();
  const reasons = new Map<string, ShoppingItem["reason"]>();

  const bump = (slug: string, reason: ShoppingItem["reason"]) => {
    counts.set(slug, (counts.get(slug) ?? 0) + 1);
    const existing = reasons.get(slug);
    if (!existing || REASON_ORDER[reason] < REASON_ORDER[existing]) {
      reasons.set(slug, reason);
    }
  };

  for (const entry of entries) {
    if (entry.composition) {
      const used = [
        entry.composition.base,
        ...entry.composition.spreads,
        ...entry.composition.proteins,
        ...entry.composition.sides,
        ...entry.composition.separate,
      ];
      for (const slug of used) {
        // Only genuinely scarce items belong on the list; a plentiful
        // ingredient the plan uses is not a shopping need.
        const state = availability.get(slug);
        if (state === "low") bump(slug, "running_low");
        else if (state === "out" || state === undefined) bump(slug, "out_of_stock");
      }
    } else if (entry.shortfall) {
      for (const slug of entry.shortfall.suggestions) bump(slug, "needed_for_shortfall");
    }
  }

  return [...counts.entries()]
    .map(([slug, timesNeeded]) => ({
      slug,
      displayName: getIngredient(slug)?.displayName ?? slug,
      reason: reasons.get(slug)!,
      timesNeeded,
    }))
    .sort((a, b) => {
      if (REASON_ORDER[a.reason] !== REASON_ORDER[b.reason]) {
        return REASON_ORDER[a.reason] - REASON_ORDER[b.reason];
      }
      if (b.timesNeeded !== a.timesNeeded) return b.timesNeeded - a.timesNeeded;
      return a.displayName.localeCompare(b.displayName);
    });
}

/**
 * Plain-text export. The affiliate cart handoff for a specific grocery chain
 * slots in behind this same signature later; nothing upstream changes.
 */
export function asPlainText(items: readonly ShoppingItem[]): string {
  if (items.length === 0) return "אין מה לקנות — יש לכם הכול.";
  return items.map((i) => `- ${i.displayName}`).join("\n");
}
