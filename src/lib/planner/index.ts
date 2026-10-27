import type {
  Child,
  HistoryEntry,
  InventoryEntry,
  PlanEntry,
  Shortfall,
} from "@/lib/domain";
import { generateCandidates } from "./compose";
import { safeInventoryFor, type SafeInventory } from "./constraints";
import { renderInstructions } from "./instructions";
import { DEFAULT_WEIGHTS, RESCUE_WEIGHTS, rankCandidates, type ScoreWeights } from "./score";

export { excludedFor, safeInventoryFor, bannedAllergensFor } from "./constraints";
export { compositionKey, usedSlugs } from "./compose";
export { renderInstructions } from "./instructions";

/** School days, Sunday-first or Monday-first depending on the household. */
export type WeekStart = "sunday" | "monday";

export type PlanOptions = {
  /** Relax variety preferences and accept any safe combination. */
  rescue?: boolean;
  weights?: ScoreWeights;
};

function diagnoseShortfall(inv: SafeInventory): Shortfall {
  const has = (cat: string) => inv.items.some((i) => i.ingredient.category === cat);
  if (inv.items.length === 0) {
    return { reason: "nothing_available", suggestions: ["whole_wheat_bread", "yellow_cheese", "cucumber"] };
  }
  if (!has("base")) {
    return { reason: "no_safe_base", suggestions: ["whole_wheat_bread", "pita", "rice_cakes"] };
  }
  return {
    reason: "no_safe_filling",
    suggestions: ["hummus", "yellow_cheese", "turkey_breast", "avocado_spread"],
  };
}

/** Plans one child for one day. Returns a shortfall rather than guessing. */
export function planDayForChild(
  child: Child,
  inventory: readonly InventoryEntry[],
  history: readonly HistoryEntry[],
  date: string,
  options: PlanOptions = {},
): PlanEntry {
  const inv = safeInventoryFor(child, inventory);
  const candidates = generateCandidates(inv, child.dislikes.rules);

  if (candidates.length === 0) {
    const shortfall = diagnoseShortfall(inv);
    return {
      childId: child.id,
      date,
      composition: null,
      instructions: `${child.name}: אי אפשר להרכיב משהו בטוח ממה שיש במלאי.`,
      shortfall,
    };
  }

  const weights = options.weights ?? (options.rescue ? RESCUE_WEIGHTS : DEFAULT_WEIGHTS);
  const ranked = rankCandidates(candidates, { child, history, date, weights });
  const best = ranked[0]!;

  return {
    childId: child.id,
    date,
    composition: best.candidate.composition,
    instructions: renderInstructions(child.name, best.candidate.composition),
  };
}

/** Morning Rush Mode: every child, one day. */
export function planDay(
  children: readonly Child[],
  inventory: readonly InventoryEntry[],
  history: readonly HistoryEntry[],
  date: string,
  options: PlanOptions = {},
): readonly PlanEntry[] {
  return children.map((child) => planDayForChild(child, inventory, history, date, options));
}

export function schoolDays(startDate: string, weekStart: WeekStart): readonly string[] {
  const start = new Date(`${startDate}T00:00:00Z`);
  // Roll forward to the first school day of the week.
  const firstDow = weekStart === "sunday" ? 0 : 1;
  while (start.getUTCDay() !== firstDow) start.setUTCDate(start.getUTCDate() + 1);

  return Array.from({ length: 5 }, (_, i) => {
    const d = new Date(start);
    d.setUTCDate(d.getUTCDate() + i);
    return d.toISOString().slice(0, 10);
  });
}

/**
 * Weekly Prep Mode: five school days, planned greedily day by day with each
 * day's choice appended to the history, so the variety rules apply *within*
 * the generated week and not only against the past.
 */
export function planWeek(
  children: readonly Child[],
  inventory: readonly InventoryEntry[],
  history: readonly HistoryEntry[],
  startDate: string,
  weekStart: WeekStart = "sunday",
  options: PlanOptions = {},
): readonly PlanEntry[] {
  const working: HistoryEntry[] = [...history];
  const entries: PlanEntry[] = [];

  for (const date of schoolDays(startDate, weekStart)) {
    for (const child of children) {
      const entry = planDayForChild(child, inventory, working, date, options);
      entries.push(entry);
      if (entry.composition) {
        working.push({ childId: child.id, date, composition: entry.composition });
      }
    }
  }
  return entries;
}

/**
 * Rescue Mode: the fridge is nearly empty. Variety is abandoned and staples
 * are accepted, but the hard safety filter is identical — this mode will
 * report that nothing can be made before it will suggest an allergen.
 */
export function planRescue(
  children: readonly Child[],
  inventory: readonly InventoryEntry[],
  date: string,
): readonly PlanEntry[] {
  return planDay(children, inventory, [], date, { rescue: true });
}
