import { describe, expect, it } from "vitest";
import { planDay } from "./planner";
import { NUT_ALLERGIC, NUT_ONLY_FRIDGE, SPARSE_FRIDGE, child, inv } from "./planner/fixtures";
import { asPlainText, buildShoppingList } from "./shopping";

const DAY = "2026-11-02";

describe("shopping list", () => {
  it("lists only ingredients that are low or absent, not plentiful ones", () => {
    const fridge = [
      { slug: "white_bread", availability: "plenty" as const },
      { slug: "hummus", availability: "low" as const },
      { slug: "carrot", availability: "plenty" as const },
    ];
    const entries = planDay([child()], fridge, [], DAY);
    const list = buildShoppingList(entries, fridge);
    const slugs = list.map((i) => i.slug);

    expect(slugs).toContain("hummus");
    expect(slugs).not.toContain("white_bread");
    expect(slugs).not.toContain("carrot");
  });

  it("puts a blocked child's unblocking ingredients first", () => {
    const entries = planDay([NUT_ALLERGIC], NUT_ONLY_FRIDGE, [], DAY);
    const list = buildShoppingList(entries, NUT_ONLY_FRIDGE);
    expect(list[0]?.reason).toBe("needed_for_shortfall");
    expect(list.map((i) => i.slug)).toContain("hummus");
  });

  it("counts how many entries need the same ingredient", () => {
    const entries = planDay([child({ id: "a" }), child({ id: "b" })], SPARSE_FRIDGE, [], DAY);
    const list = buildShoppingList(entries, SPARSE_FRIDGE);
    expect(list.find((i) => i.slug === "white_bread")?.timesNeeded).toBe(2);
  });

  it("says so plainly when there is nothing to buy", () => {
    const fridge = inv("white_bread", "hummus", "carrot");
    const entries = planDay([child()], fridge, [], DAY);
    expect(asPlainText(buildShoppingList(entries, fridge))).toMatch(/אין מה לקנות/);
  });

  it("renders display names, not slugs", () => {
    const entries = planDay([child()], SPARSE_FRIDGE, [], DAY);
    const text = asPlainText(buildShoppingList(entries, SPARSE_FRIDGE));
    expect(text).toContain("לחם לבן פרוס");
    expect(text).not.toContain("white_bread");
  });
});
