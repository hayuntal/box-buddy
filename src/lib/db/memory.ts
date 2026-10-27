import { randomUUID } from "node:crypto";
import { clearSessionCookie, currentUserId, setSessionCookie } from "@/lib/auth/cookie";
import {
  describePasswordProblem,
  hashPassword,
  isEmailShaped,
  normalizeEmail,
  verifyPassword,
} from "@/lib/auth/password";
import { DEFAULT_VARIETY, type Child } from "@/lib/domain";
import type { Tier } from "@/lib/entitlements";
import type {
  AccountInput,
  AuthResult,
  ChildInput,
  Household,
  InventoryRow,
  Repo,
  ScanRecord,
  Session,
  StoredPlan,
  StoredPlanEntry,
} from "./repo";

/**
 * Development adapter: every household lives in this process.
 *
 * It exists so the app runs end to end with no database and no credentials —
 * the same reasoning as the stub vision provider. It is seeded with one
 * household that exercises the interesting cases: a nut-allergic child at a
 * nut-free school, a picky eater, and a part-stocked fridge.
 *
 * Accounts are real: passwords are scrypt-hashed and the session is a signed
 * cookie, so the sign-in flow here is the same flow as on Postgres. What is
 * not production-grade is where it is kept — all of it is lost when the server
 * restarts.
 */

type ChildRecord = Child & { birthYear?: number; grade?: string; color: string };

type UserRecord = {
  id: string;
  email: string;
  displayName: string;
  passwordHash: string;
  householdId: string;
};

type HouseholdData = {
  household: Household;
  children: ChildRecord[];
  inventory: Map<string, InventoryRow>;
  plans: StoredPlan[];
  scans: (ScanRecord & { rawResult: unknown })[];
};

type Store = {
  usersByEmail: Map<string, UserRecord>;
  usersById: Map<string, UserRecord>;
  households: Map<string, HouseholdData>;
};

/** Shown on the sign-in screen, so the seeded household is reachable. */
export const DEMO_EMAIL = "parent@example.com";
export const DEMO_PASSWORD = "boxbuddy";

async function seed(): Promise<Store> {
  const householdId = "household-demo";
  const data: HouseholdData = {
    household: {
      id: householdId,
      name: "משק הבית לדוגמה",
      tier: "premium",
      weekStart: "sunday",
    },
    children: [
      {
        id: "child-maya",
        name: "מאיה",
        color: "violet",
        birthYear: 2018,
        grade: "ב'",
        allergies: [
          { allergen: "peanut", severity: "ban" },
          { allergen: "tree_nut", severity: "ban" },
        ],
        dislikes: { ingredients: ["mustard"], rules: ["no_wet_veg_touching_bread"] },
        variety: DEFAULT_VARIETY,
        schoolRules: ["nut_free_facility"],
      },
      {
        id: "child-liam",
        name: "ליאם",
        color: "sky",
        birthYear: 2016,
        grade: "ד'",
        allergies: [{ allergen: "dairy", severity: "avoid" }],
        dislikes: { ingredients: ["cherry_tomato", "olives"], rules: [] },
        variety: { noRepeatWithinDays: 2, maxSweetPerWeek: 2, requireFreshVeg: true },
        schoolRules: [],
      },
    ],
    inventory: new Map(
      (
        [
          ["whole_wheat_bread", "plenty"],
          ["pita", "plenty"],
          ["crackers", "low"],
          ["hummus", "plenty"],
          ["cream_cheese", "low"],
          ["chocolate_spread", "plenty"],
          ["avocado_spread", "plenty"],
          ["yellow_cheese", "plenty"],
          ["turkey_breast", "plenty"],
          ["hard_boiled_egg", "plenty"],
          ["cucumber", "plenty"],
          ["cherry_tomato", "plenty"],
          ["carrot", "plenty"],
          ["bell_pepper", "low"],
          ["apple", "plenty"],
          ["pretzels", "plenty"],
        ] as const
      ).map(([slug, availability]) => [
        slug,
        { slug, availability, source: "baseline" as const },
      ]),
    ),
    plans: [],
    scans: [],
  };

  const demo: UserRecord = {
    id: "user-demo",
    email: DEMO_EMAIL,
    displayName: "הורה לדוגמה",
    passwordHash: await hashPassword(DEMO_PASSWORD),
    householdId,
  };

  return {
    usersByEmail: new Map([[demo.email, demo]]),
    usersById: new Map([[demo.id, demo]]),
    households: new Map([[householdId, data]]),
  };
}

// Kept on globalThis so Next's dev-mode module reloading does not wipe it
// between requests. The promise itself is cached, so two concurrent first
// requests cannot each seed their own store.
const globalForStore = globalThis as unknown as { boxBuddyStore?: Promise<Store> };
function store(): Promise<Store> {
  globalForStore.boxBuddyStore ??= seed();
  return globalForStore.boxBuddyStore;
}

/** The current household's slice, created empty if it somehow went missing. */
async function householdData(householdId: string): Promise<HouseholdData> {
  const s = await store();
  let data = s.households.get(householdId);
  if (!data) {
    data = {
      household: { id: householdId, name: "משק בית", tier: "free", weekStart: "sunday" },
      children: [],
      inventory: new Map(),
      plans: [],
      scans: [],
    };
    s.households.set(householdId, data);
  }
  return data;
}

function sessionFor(user: UserRecord): Session {
  return {
    userId: user.id,
    email: user.email,
    displayName: user.displayName,
    householdId: user.householdId,
  };
}

function toChild(input: ChildInput, id: string): ChildRecord {
  return {
    id,
    name: input.name,
    color: input.color ?? "sky",
    ...(input.birthYear !== undefined ? { birthYear: input.birthYear } : {}),
    ...(input.grade !== undefined ? { grade: input.grade } : {}),
    allergies: input.allergies,
    dislikes: { ingredients: input.dislikeIngredients, rules: input.dislikeRules },
    variety: input.variety,
    schoolRules: input.schoolRules,
  };
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function memoryRepo(): Repo {
  return {
    kind: "memory",

    async getSession() {
      const userId = await currentUserId();
      if (!userId) return null;
      const user = (await store()).usersById.get(userId);
      return user ? sessionFor(user) : null;
    },

    async createAccount(input: AccountInput): Promise<AuthResult> {
      const email = normalizeEmail(input.email);
      if (!isEmailShaped(email)) return { ok: false, reason: "כתובת האימייל לא נראית תקינה." };

      const passwordProblem = describePasswordProblem(input.password);
      if (passwordProblem) return { ok: false, reason: passwordProblem };

      const s = await store();
      if (s.usersByEmail.has(email)) {
        return { ok: false, reason: "כבר קיים חשבון עם האימייל הזה." };
      }

      const householdId = `household-${randomUUID().slice(0, 8)}`;
      s.households.set(householdId, {
        household: {
          id: householdId,
          name: input.householdName.trim() || "המשפחה שלי",
          tier: "free",
          weekStart: "sunday",
        },
        children: [],
        inventory: new Map(),
        plans: [],
        scans: [],
      });

      const user: UserRecord = {
        id: `user-${randomUUID().slice(0, 8)}`,
        email,
        displayName: input.displayName.trim() || email,
        passwordHash: await hashPassword(input.password),
        householdId,
      };
      s.usersByEmail.set(email, user);
      s.usersById.set(user.id, user);

      await setSessionCookie(user.id);
      return { ok: true, session: sessionFor(user) };
    },

    async authenticate(email, password): Promise<AuthResult> {
      const user = (await store()).usersByEmail.get(normalizeEmail(email));
      // One message for both halves, so the form cannot be used to find out
      // which addresses have accounts.
      const wrong = { ok: false as const, reason: "האימייל או הסיסמה לא נכונים." };
      if (!user) return wrong;
      if (!(await verifyPassword(password, user.passwordHash))) return wrong;

      await setSessionCookie(user.id);
      return { ok: true, session: sessionFor(user) };
    },

    async endSession() {
      await clearSessionCookie();
    },

    async getHousehold(householdId) {
      const s = await store();
      return s.households.get(householdId)?.household ?? null;
    },

    async setTier(householdId, tier: Tier) {
      const data = await householdData(householdId);
      data.household.tier = tier;
    },

    async listChildren(householdId) {
      return (await householdData(householdId)).children;
    },

    async addChild(householdId, input) {
      const id = `child-${randomUUID().slice(0, 8)}`;
      (await householdData(householdId)).children.push(toChild(input, id));
      return id;
    },

    async updateChild(childId, input) {
      for (const data of (await store()).households.values()) {
        const index = data.children.findIndex((c) => c.id === childId);
        if (index >= 0) {
          data.children[index] = toChild(input, childId);
          return;
        }
      }
    },

    async removeChild(childId) {
      for (const data of (await store()).households.values()) {
        if (data.children.some((c) => c.id === childId)) {
          data.children = data.children.filter((c) => c.id !== childId);
          return;
        }
      }
    },

    async getInventory(householdId) {
      return [...(await householdData(householdId)).inventory.values()];
    },

    async setInventoryItem(householdId, row) {
      (await householdData(householdId)).inventory.set(row.slug, row);
    },

    async removeInventoryItem(householdId, slug) {
      (await householdData(householdId)).inventory.delete(slug);
    },

    async putInventory(householdId, rows) {
      const inv = (await householdData(householdId)).inventory;
      for (const row of rows) inv.set(row.slug, row);
    },

    async getHistory(householdId, sinceDate) {
      return (await householdData(householdId)).plans
        .flatMap((p) => p.entries)
        .filter(
          (e) =>
            e.date >= sinceDate && (e.status === "accepted" || e.status === "packed"),
        )
        .sort((a, b) => b.date.localeCompare(a.date));
    },

    async savePlan(householdId, plan) {
      const data = await householdData(householdId);
      const stored: StoredPlan = {
        id: `plan-${randomUUID().slice(0, 8)}`,
        mode: plan.mode,
        startDate: plan.startDate,
        shopping: plan.shopping,
        entries: plan.entries.map((e) => ({
          ...e,
          id: `entry-${randomUUID().slice(0, 8)}`,
          status: "suggested" as const,
        })),
      };
      // One plan per mode and start date; regenerating replaces it.
      data.plans = data.plans.filter(
        (p) => !(p.mode === stored.mode && p.startDate === stored.startDate),
      );
      data.plans.push(stored);
      return stored;
    },

    async getLatestPlan(householdId, mode) {
      const matching = (await householdData(householdId)).plans.filter((p) => p.mode === mode);
      return matching.at(-1) ?? null;
    },

    async setEntryStatus(entryId, status, rejectReason) {
      for (const data of (await store()).households.values()) {
        for (const plan of data.plans) {
          const entry = plan.entries.find((e) => e.id === entryId) as
            | (StoredPlanEntry & { rejectReason?: string })
            | undefined;
          if (entry) {
            entry.status = status;
            if (rejectReason) entry.rejectReason = rejectReason;
            return;
          }
        }
      }
    },

    async toggleShoppingItem(planId, slug, checked) {
      for (const data of (await store()).households.values()) {
        const plan = data.plans.find((p) => p.id === planId);
        if (!plan) continue;
        plan.shopping = plan.shopping.map((i) =>
          i.slug === slug ? { ...i, checked } : i,
        );
        return;
      }
    },

    async recordScan(householdId, scan) {
      const id = `scan-${randomUUID().slice(0, 8)}`;
      (await householdData(householdId)).scans.push({
        id,
        provider: scan.provider,
        shotCount: scan.shotCount,
        rawResult: scan.rawResult,
        createdAt: new Date().toISOString(),
      });
      return id;
    },

    async countScansToday(householdId) {
      const prefix = today();
      return (await householdData(householdId)).scans.filter((s) =>
        s.createdAt.startsWith(prefix),
      ).length;
    },
  };
}
