import { getIngredient } from "@/lib/catalog";
import type {
  Allergen,
  Child,
  Ingredient,
  InventoryEntry,
  SchoolRule,
  Trait,
} from "@/lib/domain";

/**
 * Stage 1 of the planner: narrow the inventory to what is *safe and present*
 * for one child. Nothing downstream may widen this set again — every later
 * stage only picks from what this function returns.
 *
 * This is the one place in the app where a bug can cause real harm, so the
 * rules here are deliberately blunt: a banned allergen, an unknown ingredient
 * or an out-of-stock item is dropped, with no confidence threshold, no
 * scoring, and no override path.
 */

const SCHOOL_RULE_ALLERGENS: Readonly<Record<SchoolRule, readonly Allergen[]>> = {
  nut_free_facility: ["peanut", "tree_nut"],
  sesame_free: ["sesame"],
  dairy_free: ["dairy"],
  no_meat: [],
};

const SCHOOL_RULE_TRAITS: Readonly<Record<SchoolRule, readonly Trait[]>> = {
  nut_free_facility: [],
  sesame_free: [],
  dairy_free: [],
  no_meat: ["meat"],
};

export type SafeInventory = {
  /** Safe, in-stock ingredients, with the availability that was read. */
  items: readonly SafeItem[];
  /** Allergens excluded for this child, for display and for explanations. */
  bannedAllergens: readonly Allergen[];
  bannedTraits: readonly Trait[];
};

export type SafeItem = {
  ingredient: Ingredient;
  availability: "plenty" | "low";
};

/** Allergens that are hard-banned: child `ban` severity plus school rules. */
export function bannedAllergensFor(child: Child): readonly Allergen[] {
  const banned = new Set<Allergen>();
  for (const a of child.allergies) {
    if (a.severity === "ban") banned.add(a.allergen);
  }
  for (const rule of child.schoolRules) {
    for (const a of SCHOOL_RULE_ALLERGENS[rule]) banned.add(a);
  }
  return [...banned];
}

export function bannedTraitsFor(child: Child): readonly Trait[] {
  const banned = new Set<Trait>();
  for (const rule of child.schoolRules) {
    for (const t of SCHOOL_RULE_TRAITS[rule]) banned.add(t);
  }
  return [...banned];
}

/** True when this ingredient is forbidden for the child, for any hard reason. */
export function isForbidden(
  ingredient: Ingredient,
  bannedAllergens: readonly Allergen[],
  bannedTraits: readonly Trait[],
): boolean {
  if (ingredient.allergens.some((a) => bannedAllergens.includes(a))) return true;
  if (ingredient.traits.some((t) => bannedTraits.includes(t))) return true;
  return false;
}

export function safeInventoryFor(
  child: Child,
  inventory: readonly InventoryEntry[],
): SafeInventory {
  const bannedAllergens = bannedAllergensFor(child);
  const bannedTraits = bannedTraitsFor(child);
  const items: SafeItem[] = [];

  for (const entry of inventory) {
    if (entry.availability === "out") continue;
    const ingredient = getIngredient(entry.slug);
    // An ingredient we cannot identify is treated as absent, never as safe.
    if (!ingredient) continue;
    if (isForbidden(ingredient, bannedAllergens, bannedTraits)) continue;
    items.push({ ingredient, availability: entry.availability });
  }

  return { items, bannedAllergens, bannedTraits };
}

/** Ingredients in the inventory that this child cannot have, and why. */
export function excludedFor(
  child: Child,
  inventory: readonly InventoryEntry[],
): readonly { slug: string; reason: string }[] {
  const bannedAllergens = bannedAllergensFor(child);
  const bannedTraits = bannedTraitsFor(child);
  const out: { slug: string; reason: string }[] = [];

  for (const entry of inventory) {
    const ingredient = getIngredient(entry.slug);
    if (!ingredient) continue;
    const allergen = ingredient.allergens.find((a) => bannedAllergens.includes(a));
    if (allergen) {
      out.push({ slug: entry.slug, reason: allergen.replace("_", " ") });
      continue;
    }
    const trait = ingredient.traits.find((t) => bannedTraits.includes(t));
    if (trait) out.push({ slug: entry.slug, reason: trait.replace("_", " ") });
  }
  return out;
}
