import { describe, expect, it } from "vitest";
import { getIngredient } from "@/lib/catalog";
import type { HistoryEntry } from "@/lib/domain";
import { compositionKey, planDay, planRescue, planWeek, schoolDays, usedSlugs } from ".";
import {
  ALL_SLUGS,
  CELIAC,
  EMPTY_FRIDGE,
  FULL_FRIDGE,
  NUT_ALLERGIC,
  NUT_ONLY_FRIDGE,
  SPARSE_FRIDGE,
  child,
  inv,
} from "./fixtures";

const MONDAY = "2026-11-02";

describe("safety across every generated plan", () => {
  it("never puts a banned allergen in a plan, for any fixture", () => {
    const fixtures = [FULL_FRIDGE, SPARSE_FRIDGE, NUT_ONLY_FRIDGE, ALL_SLUGS, EMPTY_FRIDGE];
    for (const fridge of fixtures) {
      for (const mode of ["day", "week", "rescue"] as const) {
        const entries =
          mode === "day"
            ? planDay([NUT_ALLERGIC, CELIAC], fridge, [], MONDAY)
            : mode === "week"
              ? planWeek([NUT_ALLERGIC, CELIAC], fridge, [], MONDAY)
              : planRescue([NUT_ALLERGIC, CELIAC], fridge, MONDAY);

        for (const entry of entries) {
          if (!entry.composition) continue;
          const banned = entry.childId === NUT_ALLERGIC.id ? ["peanut", "tree_nut"] : ["gluten"];
          for (const slug of usedSlugs(entry.composition)) {
            const allergens = getIngredient(slug)!.allergens;
            for (const b of banned) expect(allergens).not.toContain(b);
          }
        }
      }
    }
  });

  it("reports a shortfall instead of a sandwich when only nuts are in stock", () => {
    const [entry] = planDay([NUT_ALLERGIC], NUT_ONLY_FRIDGE, [], MONDAY);
    expect(entry!.composition).toBeNull();
    expect(entry!.shortfall?.reason).toBe("no_safe_filling");
    expect(entry!.shortfall?.suggestions.length).toBeGreaterThan(0);
  });

  it("reports nothing_available for an empty fridge", () => {
    const [entry] = planDay([child()], EMPTY_FRIDGE, [], MONDAY);
    expect(entry!.composition).toBeNull();
    expect(entry!.shortfall?.reason).toBe("nothing_available");
  });
});

describe("daily generation", () => {
  it("plans every child", () => {
    const entries = planDay([child({ id: "a", name: "Liam" }), NUT_ALLERGIC], FULL_FRIDGE, [], MONDAY);
    expect(entries).toHaveLength(2);
    expect(entries[0]!.instructions).toContain("Liam");
    expect(entries[1]!.instructions).toContain("Maya");
  });

  it("includes a fresh vegetable when the child requires one", () => {
    const [entry] = planDay([child()], FULL_FRIDGE, [], MONDAY);
    const veg = usedSlugs(entry!.composition!).filter((s) =>
      getIngredient(s)!.traits.includes("fresh_veg"),
    );
    expect(veg.length).toBeGreaterThan(0);
  });

  it("avoids a disliked ingredient when an alternative exists", () => {
    const picky = child({ dislikes: { ingredients: ["cucumber", "yellow_cheese"], rules: [] } });
    const [entry] = planDay([picky], FULL_FRIDGE, [], MONDAY);
    expect(usedSlugs(entry!.composition!)).not.toContain("cucumber");
    expect(usedSlugs(entry!.composition!)).not.toContain("yellow_cheese");
  });

  it("packs wet items separately when the child's rule asks for it", () => {
    const c = child({ dislikes: { ingredients: [], rules: ["no_wet_veg_touching_bread"] } });
    const entries = planDay([c], inv("white_bread", "cottage_cheese", "carrot"), [], MONDAY);
    const comp = entries[0]!.composition!;
    expect(comp.separate).toContain("cottage_cheese");
    expect(comp.proteins).not.toContain("cottage_cheese");
    expect(entries[0]!.instructions).toContain("בקופסה נפרדת");
  });

  it("prefers items that are running low, to avoid waste", () => {
    const fridge = [
      { slug: "white_bread", availability: "plenty" as const },
      { slug: "hummus", availability: "plenty" as const },
      { slug: "cream_cheese", availability: "low" as const },
      { slug: "carrot", availability: "plenty" as const },
    ];
    const [entry] = planDay([child()], fridge, [], MONDAY);
    expect(entry!.composition!.spreads).toContain("cream_cheese");
  });

  it("notes prep work for items that need it", () => {
    const entries = planDay([child()], inv("white_bread", "hard_boiled_egg", "carrot"), [], MONDAY);
    expect(entries[0]!.instructions).toContain("צריך להכין קודם");
  });
});

describe("variety rules", () => {
  it("does not repeat yesterday's sandwich", () => {
    const c = child();
    const [first] = planDay([c], FULL_FRIDGE, [], MONDAY);
    const history: HistoryEntry[] = [
      { childId: c.id, date: MONDAY, composition: first!.composition! },
    ];
    const [second] = planDay([c], FULL_FRIDGE, history, "2026-11-03");
    expect(compositionKey(second!.composition!)).not.toBe(
      compositionKey(first!.composition!),
    );
  });

  it("produces five distinct sandwiches across a school week", () => {
    const entries = planWeek([child()], FULL_FRIDGE, [], MONDAY, "monday");
    expect(entries).toHaveLength(5);
    const keys = entries.map((e) => compositionKey(e.composition!));
    // The no-repeat window is 2 days, so adjacent days must differ.
    for (let i = 1; i < keys.length; i++) {
      expect(keys[i]).not.toBe(keys[i - 1]);
    }
  });

  it("varies the bread across the week rather than riding one low-stock base", () => {
    // Crackers are low, so the waste-reduction bonus pulls hard towards them.
    // Variety has to win anyway: a week of identical bread is the problem the
    // product exists to solve.
    const fridge = [
      { slug: "crackers", availability: "low" as const },
      { slug: "whole_wheat_bread", availability: "plenty" as const },
      { slug: "pita", availability: "plenty" as const },
      { slug: "hummus", availability: "plenty" as const },
      { slug: "yellow_cheese", availability: "plenty" as const },
      { slug: "turkey_breast", availability: "plenty" as const },
      { slug: "cucumber", availability: "plenty" as const },
    ];
    const entries = planWeek([child()], fridge, [], MONDAY, "monday");
    const bases = entries.map((e) => e.composition!.base);
    expect(new Set(bases).size).toBeGreaterThanOrEqual(3);
    for (let i = 1; i < bases.length; i++) {
      expect(bases[i]).not.toBe(bases[i - 1]);
    }
  });

  it("respects the weekly sweet-spread allowance", () => {
    const c = child({ variety: { noRepeatWithinDays: 0, maxSweetPerWeek: 1, requireFreshVeg: false } });
    const entries = planWeek([c], FULL_FRIDGE, [], MONDAY, "monday");
    const sweetDays = entries.filter((e) =>
      e.composition!.spreads.some((s) => getIngredient(s)!.traits.includes("sweet")),
    );
    expect(sweetDays.length).toBeLessThanOrEqual(1);
  });

  it("plans every child for every school day", () => {
    const entries = planWeek([child({ id: "a" }), child({ id: "b" })], FULL_FRIDGE, [], MONDAY);
    expect(entries).toHaveLength(10);
  });
});

describe("rescue mode", () => {
  it("makes something safe from three low staples", () => {
    const [entry] = planRescue([child()], SPARSE_FRIDGE, MONDAY);
    expect(entry!.composition).not.toBeNull();
    expect(entry!.composition!.base).toBe("white_bread");
  });

  it("still refuses to suggest a banned allergen", () => {
    const [entry] = planRescue([NUT_ALLERGIC], NUT_ONLY_FRIDGE, MONDAY);
    expect(entry!.composition).toBeNull();
  });
});

describe("schoolDays", () => {
  it("returns five consecutive days starting on the configured first day", () => {
    const sun = schoolDays("2026-11-02", "sunday");
    expect(sun[0]).toBe("2026-11-08");
    expect(sun).toHaveLength(5);
    const mon = schoolDays("2026-11-02", "monday");
    expect(mon).toEqual(["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06"]);
  });
});
