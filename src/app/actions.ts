"use server";

import { revalidatePath } from "next/cache";
import type { ChildInput, InventoryRow, StoredPlanEntry } from "@/lib/db";
import type { Availability, HistoryEntry } from "@/lib/domain";
import { planDay, planRescue, planWeek, schoolDays } from "@/lib/planner";
import { buildShoppingList } from "@/lib/shopping";
import { assertAllowed, requireContext } from "@/lib/session";
import { getVisionProvider, normalizeScan, type FixtureName } from "@/lib/vision";

/** Every mutation the UI can perform. Tier checks happen here, never in the UI. */

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

function toHistory(entries: readonly StoredPlanEntry[]): HistoryEntry[] {
  return entries
    .filter((e) => e.composition !== null)
    .map((e) => ({ childId: e.childId, date: e.date, composition: e.composition! }));
}

export async function generateToday() {
  const ctx = await requireContext();
  const [children, inventory, history] = await Promise.all([
    ctx.repo.listChildren(ctx.session.householdId),
    ctx.repo.getInventory(ctx.session.householdId),
    ctx.repo.getHistory(ctx.session.householdId, daysAgo(7)),
  ]);

  const date = today();
  const entries = planDay(children, inventory, toHistory(history), date);

  await ctx.repo.savePlan(ctx.session.householdId, {
    mode: "daily",
    startDate: date,
    entries,
    shopping: buildShoppingList(entries, inventory),
  });

  revalidatePath("/today");
}

export async function generateRescue() {
  const ctx = await requireContext();
  const [children, inventory] = await Promise.all([
    ctx.repo.listChildren(ctx.session.householdId),
    ctx.repo.getInventory(ctx.session.householdId),
  ]);

  const date = today();
  const entries = planRescue(children, inventory, date);

  await ctx.repo.savePlan(ctx.session.householdId, {
    mode: "rescue",
    startDate: date,
    entries,
    shopping: buildShoppingList(entries, inventory),
  });

  revalidatePath("/today");
}

export async function generateWeek() {
  const ctx = await requireContext();
  assertAllowed(ctx, { type: "plan_week" });

  const [children, inventory, history] = await Promise.all([
    ctx.repo.listChildren(ctx.session.householdId),
    ctx.repo.getInventory(ctx.session.householdId),
    ctx.repo.getHistory(ctx.session.householdId, daysAgo(7)),
  ]);

  const start = schoolDays(today(), ctx.household.weekStart)[0]!;
  const entries = planWeek(
    children,
    inventory,
    toHistory(history),
    today(),
    ctx.household.weekStart,
  );

  await ctx.repo.savePlan(ctx.session.householdId, {
    mode: "weekly",
    startDate: start,
    entries,
    shopping: buildShoppingList(entries, inventory),
  });

  revalidatePath("/week");
}

export async function setEntryStatus(
  entryId: string,
  status: StoredPlanEntry["status"],
  rejectReason?: string,
) {
  const ctx = await requireContext();
  await ctx.repo.setEntryStatus(entryId, status, rejectReason);
  revalidatePath("/today");
  revalidatePath("/week");
}

export async function setPantryItem(slug: string, availability: Availability | null) {
  const ctx = await requireContext();
  if (availability === null) {
    await ctx.repo.removeInventoryItem(ctx.session.householdId, slug);
  } else {
    await ctx.repo.setInventoryItem(ctx.session.householdId, {
      slug,
      availability,
      source: "baseline",
    });
  }
  revalidatePath("/pantry");
  revalidatePath("/today");
}

export async function toggleShoppingItem(planId: string, slug: string, checked: boolean) {
  const ctx = await requireContext();
  await ctx.repo.toggleShoppingItem(planId, slug, checked);
  revalidatePath("/week");
}

/**
 * Runs a scan and returns what was found for the parent to confirm. Nothing
 * reaches the inventory until they accept it in `applyScan` — a scan is a
 * suggestion, not a write.
 */
/** The photo slots, in the order the scan screen shows them. */
const SHOT_ORDER = ["door", "shelf", "drawer", "pantry"] as const;

export async function runScan(
  shots: readonly { base64: string; mediaType: string; slot: number }[],
  fixture?: FixtureName,
) {
  const ctx = await requireContext();
  const shotCount = Math.max(1, shots.length);
  assertAllowed(ctx, { type: "run_scan", shots: shotCount });

  const provider = getVisionProvider(fixture);
  // The stub ignores the bytes and answers from a fixture; without a photo it
  // still needs one slot to describe, which is what the fallback is for.
  const images =
    shots.length > 0
      ? shots.map((s) => ({
          base64: s.base64,
          mediaType: s.mediaType,
          shotType: SHOT_ORDER[s.slot] ?? ("unknown" as const),
        }))
      : [{ base64: "", mediaType: "image/jpeg", shotType: "unknown" as const }];

  if (provider.name.startsWith("anthropic") && shots.length === 0) {
    throw new Error("צלמו לפחות תמונה אחת לפני הסריקה.");
  }

  const result = await provider.analyze({ images });

  await ctx.repo.recordScan(ctx.session.householdId, {
    provider: provider.name,
    shotCount,
    rawResult: result,
  });

  revalidatePath("/scan");
  return normalizeScan(result);
}

export async function applyScan(rows: readonly InventoryRow[]) {
  const ctx = await requireContext();
  await ctx.repo.putInventory(ctx.session.householdId, rows);
  revalidatePath("/pantry");
  revalidatePath("/today");
}

export async function saveChild(input: ChildInput, childId?: string) {
  const ctx = await requireContext();
  if (childId) {
    await ctx.repo.updateChild(childId, input);
  } else {
    assertAllowed(ctx, { type: "add_child" });
    await ctx.repo.addChild(ctx.session.householdId, input);
  }
  revalidatePath("/children");
  revalidatePath("/today");
}

export async function removeChild(childId: string) {
  const ctx = await requireContext();
  await ctx.repo.removeChild(childId);
  revalidatePath("/children");
  revalidatePath("/today");
}

/** Development affordance: flip the tier to see both sides of the paywall. */
export async function setTier(tier: "free" | "premium") {
  const ctx = await requireContext();
  await ctx.repo.setTier(ctx.session.householdId, tier);
  revalidatePath("/", "layout");
}
