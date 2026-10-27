import { CATALOG } from "@/lib/catalog";
import { DEFAULT_VARIETY, type Child, type InventoryEntry } from "@/lib/domain";

/** Shared test and demo fixtures. Not imported by production code paths. */

export function inv(...slugs: string[]): InventoryEntry[] {
  return slugs.map((slug) => ({ slug, availability: "plenty" as const }));
}

export const FULL_FRIDGE: InventoryEntry[] = inv(
  "white_bread",
  "whole_wheat_bread",
  "pita",
  "tortilla",
  "crackers",
  "butter",
  "cream_cheese",
  "hummus",
  "chocolate_spread",
  "peanut_butter",
  "jam",
  "avocado_spread",
  "yellow_cheese",
  "white_cheese",
  "turkey_breast",
  "hard_boiled_egg",
  "tuna_salad",
  "cucumber",
  "cherry_tomato",
  "carrot",
  "bell_pepper",
  "apple",
  "grapes",
  "yoghurt",
  "pretzels",
);

export const SPARSE_FRIDGE: InventoryEntry[] = [
  { slug: "white_bread", availability: "low" },
  { slug: "margarine", availability: "low" },
  { slug: "carrot", availability: "low" },
];

/** Every base and filling in this fridge carries a nut allergen. */
export const NUT_ONLY_FRIDGE: InventoryEntry[] = inv(
  "white_bread",
  "peanut_butter",
  "almond_butter",
  "almonds",
  "chocolate_spread",
);

export const EMPTY_FRIDGE: InventoryEntry[] = [];

export const ALL_SLUGS: InventoryEntry[] = CATALOG.map((i) => ({
  slug: i.slug,
  availability: "plenty" as const,
}));

export function child(overrides: Partial<Child> = {}): Child {
  return {
    id: "c1",
    name: "Liam",
    allergies: [],
    dislikes: { ingredients: [], rules: [] },
    variety: DEFAULT_VARIETY,
    schoolRules: [],
    ...overrides,
  };
}

export const NUT_ALLERGIC = child({
  id: "c-nut",
  name: "Maya",
  allergies: [
    { allergen: "peanut", severity: "ban" },
    { allergen: "tree_nut", severity: "ban" },
  ],
});

export const CELIAC = child({
  id: "c-gf",
  name: "Noa",
  allergies: [{ allergen: "gluten", severity: "ban" }],
});
