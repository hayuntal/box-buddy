/**
 * Shared domain vocabulary. The planner, the vision normalizer and the
 * database layer all speak these types; nothing here touches I/O.
 */

export const ALLERGENS = [
  "peanut",
  "tree_nut",
  "sesame",
  "dairy",
  "gluten",
  "egg",
  "soy",
  "fish",
  "shellfish",
] as const;
export type Allergen = (typeof ALLERGENS)[number];

export const CATEGORIES = ["base", "spread", "protein", "side"] as const;
export type Category = (typeof CATEGORIES)[number];

export const AVAILABILITY = ["plenty", "low", "out"] as const;
export type Availability = (typeof AVAILABILITY)[number];

/** Traits the planner reasons about beyond allergens. */
export const TRAITS = [
  "sweet", // counts against a "max sweet spreads per week" rule
  "wet", // weeps into bread; gets its own container
  "fresh_veg", // satisfies a "must include a fresh vegetable" rule
  "fruit",
  "meat", // blocked by a "no meat" school rule
  "needs_cooking_or_prep", // e.g. hard-boiled egg: shown as a prep note
] as const;
export type Trait = (typeof TRAITS)[number];

export type Ingredient = {
  slug: string;
  displayName: string;
  category: Category;
  allergens: readonly Allergen[];
  traits: readonly Trait[];
  /** Part of the baseline pantry checklist shown during onboarding. */
  isStaple: boolean;
};

export type InventoryEntry = {
  slug: string;
  availability: Availability;
};

export type AllergySeverity = "ban" | "avoid";

export type ChildAllergy = {
  allergen: Allergen;
  severity: AllergySeverity;
};

/** Structural preferences that change assembly rather than exclude food. */
export const DISLIKE_RULES = ["no_wet_veg_touching_bread", "no_crusts", "nothing_mixed"] as const;
export type DislikeRule = (typeof DISLIKE_RULES)[number];

export type ChildDislikes = {
  /** Ingredient slugs the child refuses. Soft: scored, not banned. */
  ingredients: readonly string[];
  rules: readonly DislikeRule[];
};

export type VarietyRules = {
  /** No composition repeat within this many school days. 0 disables. */
  noRepeatWithinDays: number;
  /** Cap on servings of sweet-trait spreads per 5-day week. */
  maxSweetPerWeek: number;
  /** Require at least one fresh vegetable in the box. */
  requireFreshVeg: boolean;
};

export const SCHOOL_RULES = ["nut_free_facility", "sesame_free", "dairy_free", "no_meat"] as const;
export type SchoolRule = (typeof SCHOOL_RULES)[number];

export type Child = {
  id: string;
  name: string;
  allergies: readonly ChildAllergy[];
  dislikes: ChildDislikes;
  variety: VarietyRules;
  schoolRules: readonly SchoolRule[];
};

/** One lunchbox: a base plus what goes on and beside it. */
export type Composition = {
  base: string;
  spreads: readonly string[];
  proteins: readonly string[];
  sides: readonly string[];
  /** Slugs packed separately rather than in the sandwich. */
  separate: readonly string[];
};

export type PlanEntry = {
  childId: string;
  date: string; // ISO yyyy-mm-dd
  composition: Composition | null;
  instructions: string;
  /** Present when no safe composition could be built. */
  shortfall?: Shortfall;
};

export type Shortfall = {
  reason: "no_safe_base" | "no_safe_filling" | "nothing_available";
  /** Ingredient slugs that would unblock this child, best first. */
  suggestions: readonly string[];
};

/** History the variety rules read: what the child actually ate. */
export type HistoryEntry = {
  childId: string;
  date: string;
  composition: Composition;
};

export const DEFAULT_VARIETY: VarietyRules = {
  noRepeatWithinDays: 2,
  maxSweetPerWeek: 1,
  requireFreshVeg: true,
};
