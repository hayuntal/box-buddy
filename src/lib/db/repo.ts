import type {
  Allergen,
  AllergySeverity,
  Availability,
  Child,
  DislikeRule,
  PlanEntry,
  SchoolRule,
  VarietyRules,
} from "@/lib/domain";
import type { Tier } from "@/lib/entitlements";
import type { WeekStart } from "@/lib/planner";
import type { ShoppingItem } from "@/lib/shopping";

/**
 * Everything the app needs from storage, as one interface.
 *
 * Two adapters implement it: `supabase` (Postgres + RLS, the production path)
 * and `memory` (a seeded in-process store used in development, so the app
 * runs with no database and no credentials). The UI and the Server Actions
 * only ever see this interface.
 */

export type Household = {
  id: string;
  name: string;
  tier: Tier;
  weekStart: WeekStart;
};

export type Session = {
  userId: string;
  email: string;
  displayName: string;
  householdId: string;
};

export type AccountInput = {
  email: string;
  password: string;
  displayName: string;
  householdName: string;
};

/**
 * Sign-in and sign-up never throw on a bad password or a taken address —
 * those are ordinary answers the form shows, not faults. `reason` is Hebrew
 * and deliberately vague about which half was wrong.
 */
export type AuthResult = { ok: true; session: Session } | { ok: false; reason: string };

export type ChildInput = {
  name: string;
  birthYear?: number;
  grade?: string;
  color?: string;
  allergies: readonly { allergen: Allergen; severity: AllergySeverity }[];
  dislikeIngredients: readonly string[];
  dislikeRules: readonly DislikeRule[];
  variety: VarietyRules;
  schoolRules: readonly SchoolRule[];
};

export type InventoryRow = {
  slug: string;
  availability: Availability;
  source: "scan" | "manual" | "baseline";
  confidence?: number;
};

export type StoredPlan = {
  id: string;
  mode: "daily" | "weekly" | "rescue";
  startDate: string;
  entries: readonly StoredPlanEntry[];
  shopping: readonly ShoppingItem[];
};

export type StoredPlanEntry = PlanEntry & {
  id: string;
  status: "suggested" | "accepted" | "rejected" | "packed";
};

export type ScanRecord = {
  id: string;
  provider: string;
  shotCount: number;
  createdAt: string;
};

export type Repo = {
  readonly kind: "memory" | "supabase";

  getSession(): Promise<Session | null>;
  /** Creates the user, their household, and signs them in. */
  createAccount(input: AccountInput): Promise<AuthResult>;
  /** Signs an existing user in; the adapter writes its own session cookie. */
  authenticate(email: string, password: string): Promise<AuthResult>;
  endSession(): Promise<void>;
  getHousehold(householdId: string): Promise<Household | null>;
  setTier(householdId: string, tier: Tier): Promise<void>;

  listChildren(householdId: string): Promise<readonly Child[]>;
  addChild(householdId: string, input: ChildInput): Promise<string>;
  updateChild(childId: string, input: ChildInput): Promise<void>;
  removeChild(childId: string): Promise<void>;

  getInventory(householdId: string): Promise<readonly InventoryRow[]>;
  setInventoryItem(householdId: string, row: InventoryRow): Promise<void>;
  removeInventoryItem(householdId: string, slug: string): Promise<void>;
  /** Upserts many rows at once, as a scan or a pantry toggle batch does. */
  putInventory(householdId: string, rows: readonly InventoryRow[]): Promise<void>;

  /** Accepted and packed entries, newest first, for the variety rules. */
  getHistory(householdId: string, sinceDate: string): Promise<readonly StoredPlanEntry[]>;
  savePlan(
    householdId: string,
    plan: Omit<StoredPlan, "id" | "entries"> & {
      entries: readonly PlanEntry[];
    },
  ): Promise<StoredPlan>;
  getLatestPlan(householdId: string, mode: StoredPlan["mode"]): Promise<StoredPlan | null>;
  setEntryStatus(entryId: string, status: StoredPlanEntry["status"], rejectReason?: string): Promise<void>;
  toggleShoppingItem(planId: string, slug: string, checked: boolean): Promise<void>;

  recordScan(householdId: string, scan: Omit<ScanRecord, "id" | "createdAt"> & { rawResult: unknown }): Promise<string>;
  countScansToday(householdId: string): Promise<number>;
};
