import { createClient } from "@/lib/supabase/server";
import { DEFAULT_VARIETY, type Child, type DislikeRule, type SchoolRule } from "@/lib/domain";
import {
  describePasswordProblem,
  isEmailShaped,
  normalizeEmail,
} from "@/lib/auth/password";
import type {
  AccountInput,
  AuthResult,
  ChildInput,
  Household,
  InventoryRow,
  Repo,
  StoredPlan,
  StoredPlanEntry,
} from "./repo";

/**
 * Production adapter. Every query is scoped by RLS rather than by an explicit
 * household filter in the SQL — `current_household_id()` in the migration is
 * the single enforcement point, so a missed `.eq("household_id", ...)` here
 * cannot leak another family's data.
 */

type ChildRow = {
  id: string;
  name: string;
  birth_year: number | null;
  grade: string | null;
  color: string;
  child_allergies: { allergen: Child["allergies"][number]["allergen"]; severity: "ban" | "avoid" }[];
  child_dislikes: { kind: "ingredient" | "rule"; value: string }[];
  child_variety_rules: {
    no_repeat_within_days: number;
    max_sweet_per_week: number;
    require_fresh_veg: boolean;
  } | null;
  school_rules: { rule_key: string }[];
};

const CHILD_SELECT = `
  id, name, birth_year, grade, color,
  child_allergies ( allergen, severity ),
  child_dislikes ( kind, value ),
  child_variety_rules ( no_repeat_within_days, max_sweet_per_week, require_fresh_veg ),
  school_rules ( rule_key )
`;

function rowToChild(row: ChildRow): Child {
  return {
    id: row.id,
    name: row.name,
    allergies: row.child_allergies.map((a) => ({ allergen: a.allergen, severity: a.severity })),
    dislikes: {
      ingredients: row.child_dislikes.filter((d) => d.kind === "ingredient").map((d) => d.value),
      rules: row.child_dislikes
        .filter((d) => d.kind === "rule")
        .map((d) => d.value as DislikeRule),
    },
    variety: row.child_variety_rules
      ? {
          noRepeatWithinDays: row.child_variety_rules.no_repeat_within_days,
          maxSweetPerWeek: row.child_variety_rules.max_sweet_per_week,
          requireFreshVeg: row.child_variety_rules.require_fresh_veg,
        }
      : DEFAULT_VARIETY,
    schoolRules: row.school_rules.map((r) => r.rule_key as SchoolRule),
  };
}

/** Replaces a child's rule rows; called on create and on update alike. */
async function writeChildRules(
  supabase: Awaited<ReturnType<typeof createClient>>,
  householdId: string,
  childId: string,
  input: ChildInput,
) {
  await Promise.all([
    supabase.from("child_allergies").delete().eq("child_id", childId),
    supabase.from("child_dislikes").delete().eq("child_id", childId),
    supabase.from("school_rules").delete().eq("child_id", childId),
  ]);

  const writes: PromiseLike<unknown>[] = [
    supabase.from("child_variety_rules").upsert({
      child_id: childId,
      no_repeat_within_days: input.variety.noRepeatWithinDays,
      max_sweet_per_week: input.variety.maxSweetPerWeek,
      require_fresh_veg: input.variety.requireFreshVeg,
    }),
  ];

  if (input.allergies.length > 0) {
    writes.push(
      supabase
        .from("child_allergies")
        .insert(input.allergies.map((a) => ({ child_id: childId, ...a }))),
    );
  }

  const dislikes = [
    ...input.dislikeIngredients.map((value) => ({ child_id: childId, kind: "ingredient", value })),
    ...input.dislikeRules.map((value) => ({ child_id: childId, kind: "rule", value })),
  ];
  if (dislikes.length > 0) writes.push(supabase.from("child_dislikes").insert(dislikes));

  if (input.schoolRules.length > 0) {
    writes.push(
      supabase.from("school_rules").insert(
        input.schoolRules.map((rule_key) => ({
          household_id: householdId,
          child_id: childId,
          rule_key,
        })),
      ),
    );
  }

  await Promise.all(writes);
}

function entryToRow(planId: string, entry: StoredPlanEntry | (StoredPlanEntry & object)) {
  return {
    meal_plan_id: planId,
    child_id: entry.childId,
    entry_date: entry.date,
    status: entry.status,
    base_slug: entry.composition?.base ?? null,
    spread_slugs: entry.composition?.spreads ?? [],
    protein_slugs: entry.composition?.proteins ?? [],
    side_slugs: entry.composition?.sides ?? [],
    separate_slugs: entry.composition?.separate ?? [],
    instructions: entry.instructions,
    shortfall_reason: entry.shortfall?.reason ?? null,
  };
}

type EntryRow = {
  id: string;
  child_id: string;
  entry_date: string;
  status: StoredPlanEntry["status"];
  base_slug: string | null;
  spread_slugs: string[];
  protein_slugs: string[];
  side_slugs: string[];
  separate_slugs: string[];
  instructions: string;
};

function rowToEntry(row: EntryRow): StoredPlanEntry {
  return {
    id: row.id,
    childId: row.child_id,
    date: row.entry_date,
    status: row.status,
    instructions: row.instructions,
    composition: row.base_slug
      ? {
          base: row.base_slug,
          spreads: row.spread_slugs,
          proteins: row.protein_slugs,
          sides: row.side_slugs,
          separate: row.separate_slugs,
        }
      : null,
  };
}

export function supabaseRepo(): Repo {
  return {
    kind: "supabase",

    async getSession() {
      const supabase = await createClient();
      const { data } = await supabase.auth.getUser();
      if (!data.user) return null;

      const { data: profile } = await supabase
        .from("profiles")
        .select("household_id, display_name")
        .eq("id", data.user.id)
        .maybeSingle();
      if (!profile) return null;

      return {
        userId: data.user.id,
        email: data.user.email ?? "",
        displayName: profile.display_name ?? data.user.email ?? "",
        householdId: profile.household_id,
      };
    },

    async createAccount(input: AccountInput): Promise<AuthResult> {
      const email = normalizeEmail(input.email);
      if (!isEmailShaped(email)) return { ok: false, reason: "כתובת האימייל לא נראית תקינה." };

      const passwordProblem = describePasswordProblem(input.password);
      if (passwordProblem) return { ok: false, reason: passwordProblem };

      const supabase = await createClient();
      const { data: signUp, error: signUpError } = await supabase.auth.signUp({
        email,
        password: input.password,
      });
      if (signUpError || !signUp.user) {
        return { ok: false, reason: signUpError?.message ?? "לא הצלחנו ליצור את החשבון." };
      }
      // With email confirmation switched on there is no session yet, so the
      // household cannot be written as this user — RLS would reject it.
      if (!signUp.session) {
        return { ok: false, reason: "שלחנו אליכם מייל אישור. אשרו אותו ואז התחברו." };
      }

      const { data: household, error: householdError } = await supabase
        .from("households")
        .insert({ name: input.householdName.trim() || "המשפחה שלי" })
        .select("id")
        .single();
      if (householdError || !household) {
        return { ok: false, reason: householdError?.message ?? "לא הצלחנו ליצור את משק הבית." };
      }

      const displayName = input.displayName.trim() || email;
      const { error: profileError } = await supabase.from("profiles").insert({
        id: signUp.user.id,
        household_id: household.id,
        display_name: displayName,
      });
      if (profileError) return { ok: false, reason: profileError.message };

      return {
        ok: true,
        session: {
          userId: signUp.user.id,
          email,
          displayName,
          householdId: household.id,
        },
      };
    },

    async authenticate(email, password): Promise<AuthResult> {
      const supabase = await createClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: normalizeEmail(email),
        password,
      });
      if (error || !data.user) {
        return { ok: false, reason: "האימייל או הסיסמה לא נכונים." };
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("household_id, display_name")
        .eq("id", data.user.id)
        .maybeSingle();
      if (!profile) {
        return { ok: false, reason: "לחשבון הזה אין עדיין משק בית." };
      }

      return {
        ok: true,
        session: {
          userId: data.user.id,
          email: data.user.email ?? "",
          displayName: profile.display_name ?? data.user.email ?? "",
          householdId: profile.household_id,
        },
      };
    },

    async endSession() {
      const supabase = await createClient();
      await supabase.auth.signOut();
    },

    async getHousehold(householdId): Promise<Household | null> {
      const supabase = await createClient();
      const { data } = await supabase
        .from("households")
        .select("id, name, tier, week_start")
        .eq("id", householdId)
        .maybeSingle();
      if (!data) return null;
      return { id: data.id, name: data.name, tier: data.tier, weekStart: data.week_start };
    },

    async setTier(householdId, tier) {
      const supabase = await createClient();
      await supabase.from("households").update({ tier }).eq("id", householdId);
    },

    async listChildren() {
      const supabase = await createClient();
      const { data } = await supabase
        .from("children")
        .select(CHILD_SELECT)
        .eq("is_active", true)
        .order("created_at");
      return ((data ?? []) as unknown as ChildRow[]).map(rowToChild);
    },

    async addChild(householdId, input) {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from("children")
        .insert({
          household_id: householdId,
          name: input.name,
          birth_year: input.birthYear ?? null,
          grade: input.grade ?? null,
          color: input.color ?? "sky",
        })
        .select("id")
        .single();
      if (error || !data) throw new Error(error?.message ?? "לא הצלחנו ליצור את פרופיל הילד.");

      await writeChildRules(supabase, householdId, data.id, input);
      return data.id;
    },

    async updateChild(childId, input) {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from("children")
        .update({
          name: input.name,
          birth_year: input.birthYear ?? null,
          grade: input.grade ?? null,
          color: input.color ?? "sky",
        })
        .eq("id", childId)
        .select("household_id")
        .single();
      if (error || !data) throw new Error(error?.message ?? "לא הצלחנו לעדכן את פרופיל הילד.");

      await writeChildRules(supabase, data.household_id, childId, input);
    },

    async removeChild(childId) {
      const supabase = await createClient();
      await supabase.from("children").update({ is_active: false }).eq("id", childId);
    },

    async getInventory() {
      const supabase = await createClient();
      const { data } = await supabase
        .from("inventory_items")
        .select("ingredient_slug, availability, source, confidence");
      return (data ?? []).map(
        (r): InventoryRow => ({
          slug: r.ingredient_slug,
          availability: r.availability,
          source: r.source,
          ...(r.confidence === null ? {} : { confidence: Number(r.confidence) }),
        }),
      );
    },

    async setInventoryItem(householdId, row) {
      await this.putInventory(householdId, [row]);
    },

    async removeInventoryItem(householdId, slug) {
      const supabase = await createClient();
      await supabase
        .from("inventory_items")
        .delete()
        .eq("household_id", householdId)
        .eq("ingredient_slug", slug);
    },

    async putInventory(householdId, rows) {
      if (rows.length === 0) return;
      const supabase = await createClient();
      await supabase.from("inventory_items").upsert(
        rows.map((r) => ({
          household_id: householdId,
          ingredient_slug: r.slug,
          availability: r.availability,
          source: r.source,
          confidence: r.confidence ?? null,
          updated_at: new Date().toISOString(),
        })),
        { onConflict: "household_id,ingredient_slug" },
      );
    },

    async getHistory(_householdId, sinceDate) {
      const supabase = await createClient();
      const { data } = await supabase
        .from("meal_plan_entries")
        .select(
          "id, child_id, entry_date, status, base_slug, spread_slugs, protein_slugs, side_slugs, separate_slugs, instructions",
        )
        .in("status", ["accepted", "packed"])
        .gte("entry_date", sinceDate)
        .order("entry_date", { ascending: false });
      return ((data ?? []) as EntryRow[]).map(rowToEntry);
    },

    async savePlan(householdId, plan) {
      const supabase = await createClient();
      const { data: planRow, error } = await supabase
        .from("meal_plans")
        .insert({ household_id: householdId, mode: plan.mode, start_date: plan.startDate })
        .select("id")
        .single();
      if (error || !planRow) throw new Error(error?.message ?? "לא הצלחנו לשמור את התוכנית.");

      const { data: entryRows } = await supabase
        .from("meal_plan_entries")
        .insert(
          plan.entries.map((e) =>
            entryToRow(planRow.id, { ...e, id: "", status: "suggested" }),
          ),
        )
        .select(
          "id, child_id, entry_date, status, base_slug, spread_slugs, protein_slugs, side_slugs, separate_slugs, instructions",
        );

      if (plan.shopping.length > 0) {
        await supabase.from("shopping_items").insert(
          plan.shopping.map((i) => ({
            meal_plan_id: planRow.id,
            ingredient_slug: i.slug,
            reason: i.reason,
            times_needed: i.timesNeeded,
          })),
        );
      }

      return {
        id: planRow.id,
        mode: plan.mode,
        startDate: plan.startDate,
        shopping: plan.shopping,
        entries: ((entryRows ?? []) as EntryRow[]).map(rowToEntry),
      };
    },

    async getLatestPlan(_householdId, mode): Promise<StoredPlan | null> {
      const supabase = await createClient();
      const { data: planRow } = await supabase
        .from("meal_plans")
        .select("id, mode, start_date")
        .eq("mode", mode)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!planRow) return null;

      const [{ data: entryRows }, { data: shoppingRows }] = await Promise.all([
        supabase
          .from("meal_plan_entries")
          .select(
            "id, child_id, entry_date, status, base_slug, spread_slugs, protein_slugs, side_slugs, separate_slugs, instructions",
          )
          .eq("meal_plan_id", planRow.id)
          .order("entry_date"),
        supabase
          .from("shopping_items")
          .select("ingredient_slug, reason, times_needed, is_checked")
          .eq("meal_plan_id", planRow.id),
      ]);

      return {
        id: planRow.id,
        mode: planRow.mode,
        startDate: planRow.start_date,
        entries: ((entryRows ?? []) as EntryRow[]).map(rowToEntry),
        shopping: (shoppingRows ?? []).map((r) => ({
          slug: r.ingredient_slug,
          displayName: r.ingredient_slug,
          reason: r.reason as "running_low" | "out_of_stock" | "needed_for_shortfall",
          timesNeeded: r.times_needed,
          checked: r.is_checked,
        })),
      };
    },

    async setEntryStatus(entryId, status, rejectReason) {
      const supabase = await createClient();
      await supabase
        .from("meal_plan_entries")
        .update({ status, reject_reason: rejectReason ?? null })
        .eq("id", entryId);
    },

    async toggleShoppingItem(planId, slug, checked) {
      const supabase = await createClient();
      await supabase
        .from("shopping_items")
        .update({ is_checked: checked })
        .eq("meal_plan_id", planId)
        .eq("ingredient_slug", slug);
    },

    async recordScan(householdId, scan) {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from("scans")
        .insert({
          household_id: householdId,
          provider: scan.provider,
          shot_count: scan.shotCount,
          raw_result: scan.rawResult,
        })
        .select("id")
        .single();
      if (error || !data) throw new Error(error?.message ?? "לא הצלחנו לתעד את הסריקה.");
      return data.id;
    },

    async countScansToday() {
      const supabase = await createClient();
      const midnight = `${new Date().toISOString().slice(0, 10)}T00:00:00Z`;
      const { count } = await supabase
        .from("scans")
        .select("id", { count: "exact", head: true })
        .gte("created_at", midnight);
      return count ?? 0;
    },
  };
}
