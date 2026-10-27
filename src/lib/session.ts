import { getRepo } from "@/lib/db";
import type { Household, Repo, Session } from "@/lib/db";
import { can, type Action, type Usage } from "@/lib/entitlements";

/**
 * Loads the current parent, their household and their usage in one place, so
 * every page and action starts from the same picture and every tier check is
 * made server-side against it.
 */

export type Context = {
  repo: Repo;
  session: Session;
  household: Household;
  usage: Usage;
};

export async function loadContext(): Promise<Context | null> {
  const repo = getRepo();
  const session = await repo.getSession();
  if (!session) return null;

  const household = await repo.getHousehold(session.householdId);
  if (!household) return null;

  const [children, scansToday] = await Promise.all([
    repo.listChildren(session.householdId),
    repo.countScansToday(session.householdId),
  ]);

  return {
    repo,
    session,
    household,
    usage: { childCount: children.length, scansToday },
  };
}

export async function requireContext(): Promise<Context> {
  const ctx = await loadContext();
  if (!ctx) throw new Error("לא מחוברים.");
  return ctx;
}

/** Throws unless the household's tier permits the action. */
export function assertAllowed(ctx: Context, action: Action): void {
  const verdict = can(ctx.household.tier, ctx.usage, action);
  if (!verdict.allowed) throw new Error(verdict.reason);
}

export function allows(ctx: Context, action: Action): boolean {
  return can(ctx.household.tier, ctx.usage, action).allowed;
}
