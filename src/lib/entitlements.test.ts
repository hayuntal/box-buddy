import { describe, expect, it } from "vitest";
import { allowedShots, can } from "./entitlements";

const fresh = { childCount: 0, scansToday: 0 };

describe("free tier limits", () => {
  it("allows the first child and refuses the second", () => {
    expect(can("free", fresh, { type: "add_child" }).allowed).toBe(true);
    expect(can("free", { ...fresh, childCount: 1 }, { type: "add_child" }).allowed).toBe(false);
  });

  it("allows one single-shot scan a day", () => {
    expect(can("free", fresh, { type: "run_scan", shots: 1 }).allowed).toBe(true);
    expect(can("free", fresh, { type: "run_scan", shots: 4 }).allowed).toBe(false);
    expect(can("free", { ...fresh, scansToday: 1 }, { type: "run_scan", shots: 1 }).allowed).toBe(false);
  });

  it("gates the weekly planner, shopping list and household sync", () => {
    expect(can("free", fresh, { type: "plan_week" }).allowed).toBe(false);
    expect(can("free", fresh, { type: "view_shopping_list" }).allowed).toBe(false);
    expect(can("free", fresh, { type: "invite_parent" }).allowed).toBe(false);
  });

  it("explains every denial and marks it as an upgrade path", () => {
    const verdict = can("free", fresh, { type: "plan_week" });
    expect(verdict.allowed).toBe(false);
    if (!verdict.allowed) {
      expect(verdict.reason).toMatch(/פרימיום/);
      expect(verdict.upgrade).toBe(true);
    }
  });
});

describe("premium tier", () => {
  it("allows everything the free tier blocks", () => {
    const heavy = { childCount: 12, scansToday: 30 };
    expect(can("premium", heavy, { type: "add_child" }).allowed).toBe(true);
    expect(can("premium", heavy, { type: "run_scan", shots: 4 }).allowed).toBe(true);
    expect(can("premium", heavy, { type: "plan_week" }).allowed).toBe(true);
    expect(can("premium", heavy, { type: "view_shopping_list" }).allowed).toBe(true);
    expect(can("premium", heavy, { type: "invite_parent" }).allowed).toBe(true);
  });

  it("still caps a scan at four shots", () => {
    expect(can("premium", fresh, { type: "run_scan", shots: 5 }).allowed).toBe(false);
    expect(allowedShots("premium", 9)).toBe(4);
    expect(allowedShots("free", 9)).toBe(1);
  });
});
