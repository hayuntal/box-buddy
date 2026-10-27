import { CATALOG, getIngredient } from "@/lib/catalog";
import type { Availability } from "@/lib/domain";
import type { VisionItem, VisionResult } from "./types";

/**
 * Turns a raw model response into inventory rows. Three jobs: map free-form
 * slugs back onto the catalog, drop what we cannot trust, and split the rest
 * into "apply it" and "ask the parent first".
 */

export const DROP_BELOW = 0.3;
export const REVIEW_BELOW = 0.5;

export type NormalizedItem = {
  slug: string;
  displayName: string;
  availability: Extract<Availability, "plenty" | "low">;
  confidence: number;
  /** Set when the model's slug was not an exact catalog hit. */
  matchedFrom?: string;
};

export type NormalizedScan = {
  /** High-confidence catalog matches, safe to apply directly. */
  confirmed: readonly NormalizedItem[];
  /** Shown to the parent as unchecked chips to confirm or dismiss. */
  needsReview: readonly NormalizedItem[];
  /** Model output we could not place in the catalog at all. */
  unmatched: readonly { displayName: string; confidence: number }[];
  unreadableShots: readonly string[];
};

/**
 * Unicode-aware, because display names are Hebrew while slugs stay English.
 * An ASCII-only version collapses every Hebrew name to an empty string, which
 * would then match the first catalog entry — so the letter class matters.
 */
function normalizeToken(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "_")
    .replace(/^_+|_+$/g, "");
}

/** Catalog lookup by slug, then by display name, then by token overlap. */
export function matchToCatalog(item: VisionItem): { slug: string; exact: boolean } | null {
  const slug = normalizeToken(item.slug);
  if (getIngredient(slug)) return { slug, exact: true };

  const normalizedName = normalizeToken(item.display_name);
  if (normalizedName.length > 0) {
    const byName = CATALOG.find((i) => normalizeToken(i.displayName) === normalizedName);
    if (byName) return { slug: byName.slug, exact: false };
  }

  // Token overlap: "sliced_yellow_cheese" → "yellow_cheese".
  const tokens = new Set(slug.split("_").filter((t) => t.length > 2));
  if (tokens.size === 0) return null;

  let best: { slug: string; overlap: number } | null = null;
  for (const candidate of CATALOG) {
    const candidateTokens = candidate.slug.split("_").filter((t) => t.length > 2);
    if (candidateTokens.length === 0) continue;
    const overlap = candidateTokens.filter((t) => tokens.has(t)).length / candidateTokens.length;
    if (overlap >= 0.5 && (!best || overlap > best.overlap)) {
      best = { slug: candidate.slug, overlap };
    }
  }
  return best ? { slug: best.slug, exact: false } : null;
}

export function normalizeScan(result: VisionResult): NormalizedScan {
  const confirmed: NormalizedItem[] = [];
  const needsReview: NormalizedItem[] = [];
  const unmatched: { displayName: string; confidence: number }[] = [];
  const seen = new Set<string>();

  for (const item of result.items) {
    if (item.confidence < DROP_BELOW) continue;

    const match = matchToCatalog(item);
    if (!match) {
      unmatched.push({ displayName: item.display_name, confidence: item.confidence });
      continue;
    }
    if (seen.has(match.slug)) continue;
    seen.add(match.slug);

    const ingredient = getIngredient(match.slug)!;
    const normalized: NormalizedItem = {
      slug: match.slug,
      displayName: ingredient.displayName,
      availability: item.availability,
      confidence: item.confidence,
      ...(match.exact ? {} : { matchedFrom: item.display_name }),
    };

    // A fuzzy match is never applied silently, however confident the model
    // was — the parent sees what we decided it meant.
    if (item.confidence < REVIEW_BELOW || !match.exact) needsReview.push(normalized);
    else confirmed.push(normalized);
  }

  return {
    confirmed,
    needsReview,
    unmatched,
    unreadableShots: result.unreadable_shots,
  };
}
