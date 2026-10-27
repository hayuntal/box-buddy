import { getIngredient, hasTrait } from "@/lib/catalog";
import type { Child, HistoryEntry } from "@/lib/domain";
import type { Candidate } from "./compose";
import { compositionKey, usedSlugs } from "./compose";

/**
 * Stage 3: score the safe candidates. Everything here is a *preference* —
 * nothing in this file can make an unsafe composition acceptable, because it
 * only ever sees candidates that already passed the hard filter.
 */

export type ScoreWeights = {
  repeat: number;
  recentBase: number;
  recentIngredient: number;
  sweetOverBudget: number;
  missingFreshVeg: number;
  dislikedIngredient: number;
  softAllergen: number;
  usesLowStock: number;
  hasProtein: number;
  hasFruit: number;
  needsPrep: number;
};

/** How far back the base-repetition penalty looks, in days. */
export const BASE_WINDOW_DAYS = 4;

/** A single composition earns the low-stock bonus at most this many times. */
export const LOW_STOCK_BONUS_CAP = 2;

export const DEFAULT_WEIGHTS: ScoreWeights = {
  repeat: -100, // same sandwich inside the no-repeat window
  // Bread is what a week of lunches looks like, so the same base two days
  // running is penalised on its own, independently of the filling. Without
  // this, one low-stock base wins every day of the week.
  recentBase: -16, // per recent day that used this same base
  recentIngredient: -6, // per ingredient also used in the window
  sweetOverBudget: -40, // a sweet spread past the weekly allowance
  missingFreshVeg: -25, // child requires a vegetable and none is present
  dislikedIngredient: -30, // per disliked ingredient
  softAllergen: -50, // `avoid` severity: discouraged, not forbidden
  usesLowStock: 8, // per low-stock item, to use food before it spoils
  hasProtein: 10,
  hasFruit: 5,
  needsPrep: -4, // boiling an egg at 07:00 is a real cost
};

/** Rescue mode cares only about safety and making *something* edible. */
export const RESCUE_WEIGHTS: ScoreWeights = {
  ...DEFAULT_WEIGHTS,
  repeat: 0,
  recentBase: 0,
  recentIngredient: 0,
  sweetOverBudget: 0,
  missingFreshVeg: 0,
};

export type ScoreContext = {
  child: Child;
  /** Entries already eaten or already planned, newest first is not required. */
  history: readonly HistoryEntry[];
  /** The day being planned, ISO yyyy-mm-dd. */
  date: string;
  weights?: ScoreWeights;
};

function daysBetween(a: string, b: string): number {
  const ms = Math.abs(Date.parse(a) - Date.parse(b));
  return Math.round(ms / 86_400_000);
}

export type ScoredCandidate = {
  candidate: Candidate;
  score: number;
  /** Human-readable reasons, for the "why this?" affordance in the UI. */
  notes: readonly string[];
};

export function scoreCandidate(candidate: Candidate, ctx: ScoreContext): ScoredCandidate {
  const w = ctx.weights ?? DEFAULT_WEIGHTS;
  const { child } = ctx;
  const c = candidate.composition;
  const notes: string[] = [];
  let score = 0;

  const window = child.variety.noRepeatWithinDays;
  const recent = ctx.history.filter(
    (h) => h.childId === child.id && daysBetween(h.date, ctx.date) <= window,
  );

  if (window > 0 && recent.some((h) => compositionKey(h.composition) === compositionKey(c))) {
    score += w.repeat;
    notes.push("same sandwich as a recent day");
  }

  // Base repetition is measured over its own, longer window.
  const recentBases = ctx.history.filter(
    (h) => h.childId === child.id && daysBetween(h.date, ctx.date) <= BASE_WINDOW_DAYS,
  );
  const sameBaseDays = recentBases.filter((h) => h.composition.base === c.base).length;
  if (sameBaseDays > 0) {
    score += sameBaseDays * w.recentBase;
    notes.push("same bread as a recent day");
  }

  const recentSlugs = new Set(recent.flatMap((h) => usedSlugs(h.composition)));
  const repeatedIngredients = usedSlugs(c).filter((s) => recentSlugs.has(s));
  score += repeatedIngredients.length * w.recentIngredient;

  // Sweet-spread budget over the whole 5-day week, not just the window.
  const weekSweets = ctx.history.filter(
    (h) =>
      h.childId === child.id &&
      daysBetween(h.date, ctx.date) <= 6 &&
      h.composition.spreads.some((s) => hasTrait(s, "sweet")),
  ).length;
  const thisIsSweet = c.spreads.some((s) => hasTrait(s, "sweet"));
  if (thisIsSweet && weekSweets >= child.variety.maxSweetPerWeek) {
    score += w.sweetOverBudget;
    notes.push("sweet-spread allowance already used this week");
  }

  if (child.variety.requireFreshVeg) {
    const hasVeg = [...c.sides, ...c.separate, ...c.spreads].some((s) => hasTrait(s, "fresh_veg"));
    if (!hasVeg) {
      score += w.missingFreshVeg;
      notes.push("no fresh vegetable");
    }
  }

  const disliked = usedSlugs(c).filter((s) => child.dislikes.ingredients.includes(s));
  score += disliked.length * w.dislikedIngredient;
  if (disliked.length > 0) notes.push(`includes a disliked item: ${disliked.join(", ")}`);

  // `avoid`-severity allergens are discouraged here rather than filtered out,
  // which is the only difference between `avoid` and `ban`.
  const softAllergens = child.allergies
    .filter((a) => a.severity === "avoid")
    .map((a) => a.allergen);
  if (softAllergens.length > 0) {
    const hits = usedSlugs(c).filter((s) =>
      (getIngredient(s)?.allergens ?? []).some((a) => softAllergens.includes(a)),
    );
    score += hits.length * w.softAllergen;
    if (hits.length > 0) notes.push("contains an allergen marked 'avoid'");
  }

  // Capped: using up what's going off is worth something, but not enough to
  // make the same low-stock lunch win every day.
  score += Math.min(candidate.usesLowStock.length, LOW_STOCK_BONUS_CAP) * w.usesLowStock;
  if (candidate.usesLowStock.length > 0) notes.push("uses up food that is running low");

  if (c.proteins.length > 0) score += w.hasProtein;
  if ([...c.sides, ...c.separate].some((s) => hasTrait(s, "fruit"))) score += w.hasFruit;

  const prep = usedSlugs(c).filter((s) => hasTrait(s, "needs_cooking_or_prep"));
  score += prep.length * w.needsPrep;

  return { candidate, score, notes };
}

/** Best candidate first. Ties break on composition key for determinism. */
export function rankCandidates(
  candidates: readonly Candidate[],
  ctx: ScoreContext,
): readonly ScoredCandidate[] {
  return candidates
    .map((c) => scoreCandidate(c, ctx))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return compositionKey(a.candidate.composition).localeCompare(
        compositionKey(b.candidate.composition),
      );
    });
}
