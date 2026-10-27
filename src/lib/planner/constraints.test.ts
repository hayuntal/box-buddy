import { describe, expect, it } from "vitest";
import { getIngredient } from "@/lib/catalog";
import { ALLERGENS, type Allergen, type Child } from "@/lib/domain";
import { bannedAllergensFor, safeInventoryFor } from "./constraints";
import { ALL_SLUGS, CELIAC, NUT_ALLERGIC, child, inv } from "./fixtures";

/**
 * These are the tests that matter. A regression here is not a cosmetic bug,
 * so they assert over the *whole* catalog rather than over a chosen example.
 */

describe("hard allergen filter", () => {
  it.each(ALLERGENS)("never admits a %s ingredient when banned", (allergen: Allergen) => {
    const c = child({ allergies: [{ allergen, severity: "ban" }] });
    const safe = safeInventoryFor(c, ALL_SLUGS);
    for (const item of safe.items) {
      expect(item.ingredient.allergens).not.toContain(allergen);
    }
  });

  it("drops peanut butter for a nut-free facility even with no child allergy", () => {
    const c = child({ schoolRules: ["nut_free_facility"] });
    const safe = safeInventoryFor(c, inv("white_bread", "peanut_butter", "almond_butter", "hummus"));
    const slugs = safe.items.map((i) => i.ingredient.slug);
    expect(slugs).toEqual(["white_bread", "hummus"]);
  });

  it("keeps 'avoid' allergens in the safe set — they are scored, not banned", () => {
    const c = child({ allergies: [{ allergen: "dairy", severity: "avoid" }] });
    const safe = safeInventoryFor(c, inv("yellow_cheese"));
    expect(safe.items).toHaveLength(1);
    expect(bannedAllergensFor(c)).toHaveLength(0);
  });

  it("treats an unrecognised slug as absent rather than safe", () => {
    const safe = safeInventoryFor(child(), [
      { slug: "mystery_jar_from_the_back", availability: "plenty" },
    ]);
    expect(safe.items).toHaveLength(0);
  });

  it("excludes out-of-stock items", () => {
    const safe = safeInventoryFor(child(), [{ slug: "white_bread", availability: "out" }]);
    expect(safe.items).toHaveLength(0);
  });

  it("applies a no-meat school rule by trait, not by allergen", () => {
    const c = child({ schoolRules: ["no_meat"] });
    const safe = safeInventoryFor(c, inv("turkey_breast", "salami", "tofu", "yellow_cheese"));
    const slugs = safe.items.map((i) => i.ingredient.slug);
    expect(slugs).toEqual(["tofu", "yellow_cheese"]);
  });

  it("combines a child ban with a school rule", () => {
    const c: Child = { ...NUT_ALLERGIC, schoolRules: ["sesame_free"] };
    const safe = safeInventoryFor(c, ALL_SLUGS);
    for (const item of safe.items) {
      expect(item.ingredient.allergens).not.toContain("peanut");
      expect(item.ingredient.allergens).not.toContain("tree_nut");
      expect(item.ingredient.allergens).not.toContain("sesame");
    }
  });

  it("leaves a coeliac child no gluten base at all", () => {
    const safe = safeInventoryFor(CELIAC, ALL_SLUGS);
    const bases = safe.items.filter((i) => i.ingredient.category === "base");
    expect(bases.length).toBeGreaterThan(0);
    for (const b of bases) {
      expect(getIngredient(b.ingredient.slug)!.allergens).not.toContain("gluten");
    }
  });
});
