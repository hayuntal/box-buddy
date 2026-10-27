import type { Composition, DislikeRule } from "@/lib/domain";
import type { SafeInventory, SafeItem } from "./constraints";

/**
 * Stage 2: build candidate lunchboxes from the safe inventory.
 *
 * There is no recipe table. A lunch is a composition — base + spreads +
 * proteins + sides — because a fixed recipe library would mostly be
 * unmakeable from whatever happens to be in a given fridge, and because
 * safety is far easier to guarantee over an ingredient set than over opaque
 * recipe rows.
 */

/** Caps the candidate set so generation stays fast on a well-stocked fridge. */
const MAX_CANDIDATES = 600;

export type Candidate = {
  composition: Composition;
  /** Availability of every slug used, for waste-reduction scoring. */
  usesLowStock: readonly string[];
};

function pick(inv: SafeInventory, category: SafeItem["ingredient"]["category"]): SafeItem[] {
  return inv.items.filter((i) => i.ingredient.category === category);
}

/**
 * Wet items weep into bread. With `no_wet_veg_touching_bread` they move to a
 * separate container rather than disqualifying the composition — the parent's
 * rule is about assembly, not about the food.
 */
function applySeparation(
  composition: Composition,
  rules: readonly DislikeRule[],
  wetSlugs: ReadonlySet<string>,
): Composition {
  if (!rules.includes("no_wet_veg_touching_bread")) return composition;

  const movedProteins = composition.proteins.filter((s) => wetSlugs.has(s));
  const keptProteins = composition.proteins.filter((s) => !wetSlugs.has(s));
  if (movedProteins.length === 0) return composition;

  return {
    ...composition,
    proteins: keptProteins,
    separate: [...composition.separate, ...movedProteins],
  };
}

export function generateCandidates(
  inv: SafeInventory,
  dislikeRules: readonly DislikeRule[],
): readonly Candidate[] {
  const bases = pick(inv, "base");
  const spreads = pick(inv, "spread");
  const proteins = pick(inv, "protein");
  const sides = pick(inv, "side");

  const lowStock = new Set(
    inv.items.filter((i) => i.availability === "low").map((i) => i.ingredient.slug),
  );
  const wet = new Set(
    inv.items.filter((i) => i.ingredient.traits.includes("wet")).map((i) => i.ingredient.slug),
  );

  const candidates: Candidate[] = [];

  // A sandwich needs a base. Spread and protein are each optional on their
  // own but a base alone is not lunch, so at least one of them is required.
  const spreadOptions: (SafeItem | null)[] = [null, ...spreads];
  const proteinOptions: (SafeItem | null)[] = [null, ...proteins];

  outer: for (const base of bases) {
    for (const spread of spreadOptions) {
      for (const protein of proteinOptions) {
        if (!spread && !protein) continue;
        // `nothing_mixed`: one filling only, never a spread *and* a protein.
        if (spread && protein && dislikeRules.includes("nothing_mixed")) continue;

        // Sides are paired one at a time; two sides are added by the scorer's
        // preferred pick below rather than multiplying the candidate space.
        for (const side of sides.length > 0 ? sides : [null]) {
          const raw: Composition = {
            base: base.ingredient.slug,
            spreads: spread ? [spread.ingredient.slug] : [],
            proteins: protein ? [protein.ingredient.slug] : [],
            sides: side ? [side.ingredient.slug] : [],
            separate: [],
          };
          const composition = applySeparation(raw, dislikeRules, wet);
          const used = [
            composition.base,
            ...composition.spreads,
            ...composition.proteins,
            ...composition.sides,
            ...composition.separate,
          ];
          candidates.push({
            composition,
            usesLowStock: used.filter((s) => lowStock.has(s)),
          });
          if (candidates.length >= MAX_CANDIDATES) break outer;
        }
      }
    }
  }

  return candidates;
}

/** Stable identity of a composition, for repeat detection across days. */
export function compositionKey(c: Composition): string {
  const parts = [
    c.base,
    [...c.spreads].sort().join("+"),
    [...c.proteins].sort().join("+"),
  ];
  return parts.join("|");
}

/** Every slug a composition consumes. */
export function usedSlugs(c: Composition): readonly string[] {
  return [...new Set([c.base, ...c.spreads, ...c.proteins, ...c.sides, ...c.separate])];
}
