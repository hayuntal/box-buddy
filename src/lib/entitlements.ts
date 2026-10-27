/**
 * Every tier limit in the product lives here. Server Actions check it before
 * acting and the UI reads the same functions to render upgrade prompts, so
 * the two can never disagree. Switching a household to premium is a single
 * column write — a Stripe webhook can do it later with no other change.
 */

export type Tier = "free" | "premium";

export type Limits = {
  maxChildren: number;
  maxScansPerDay: number;
  maxShotsPerScan: number;
  weeklyPlanner: boolean;
  shoppingList: boolean;
  householdSync: boolean;
};

export const LIMITS: Readonly<Record<Tier, Limits>> = {
  free: {
    maxChildren: 1,
    maxScansPerDay: 1,
    maxShotsPerScan: 1,
    weeklyPlanner: false,
    shoppingList: false,
    householdSync: false,
  },
  premium: {
    maxChildren: Number.POSITIVE_INFINITY,
    maxScansPerDay: Number.POSITIVE_INFINITY,
    maxShotsPerScan: 4,
    weeklyPlanner: true,
    shoppingList: true,
    householdSync: true,
  },
};

export type Usage = {
  childCount: number;
  scansToday: number;
};

export type Action =
  | { type: "add_child" }
  | { type: "run_scan"; shots: number }
  | { type: "plan_week" }
  | { type: "view_shopping_list" }
  | { type: "invite_parent" };

export type Verdict = { allowed: true } | { allowed: false; reason: string; upgrade: true };

const deny = (reason: string): Verdict => ({ allowed: false, reason, upgrade: true });
const allow: Verdict = { allowed: true };

export function can(tier: Tier, usage: Usage, action: Action): Verdict {
  const limits = LIMITS[tier];

  switch (action.type) {
    case "add_child":
      return usage.childCount < limits.maxChildren
        ? allow
        : deny(`המסלול החינמי כולל פרופיל של ${limits.maxChildren} ילד.`);

    case "run_scan":
      if (usage.scansToday >= limits.maxScansPerDay) {
        return deny("ניצלתם את סריקת המקרר החינמית של היום.");
      }
      if (action.shots > limits.maxShotsPerScan) {
        return deny(
          `המסלול החינמי סורק ${limits.maxShotsPerScan} תמונה בכל פעם; פרימיום סורק עד ${LIMITS.premium.maxShotsPerScan}.`,
        );
      }
      return allow;

    case "plan_week":
      return limits.weeklyPlanner ? allow : deny("התכנון ל-5 ימים הוא יכולת של פרימיום.");

    case "view_shopping_list":
      return limits.shoppingList
        ? allow
        : deny("רשימות קניות אוטומטיות הן יכולת של פרימיום.");

    case "invite_parent":
      return limits.householdSync
        ? allow
        : deny("שיתוף משק בית עם הורה שני הוא יכולת של פרימיום.");
  }
}

/** Clamps a requested shot count to what the tier allows. */
export function allowedShots(tier: Tier, requested: number): number {
  return Math.min(requested, LIMITS[tier].maxShotsPerScan);
}
