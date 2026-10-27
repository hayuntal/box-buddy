import type { VisionResult } from "../types";

/**
 * Hand-written responses standing in for real model output. Between them they
 * reach every downstream path — a full fridge, a rescue-mode fridge, a fridge
 * where everything safe is missing, a fuzzy match, and an unreadable photo —
 * so the whole app is exercisable with no API key and no cost.
 */

const item = (
  slug: string,
  display_name: string,
  category: VisionResult["items"][number]["category"],
  confidence = 0.9,
  availability: "plenty" | "low" = "plenty",
): VisionResult["items"][number] => ({
  slug,
  display_name,
  category,
  availability,
  confidence,
  shot: "shelf",
});

export const FIXTURES = {
  full: {
    shots_processed: ["door", "shelf", "drawer", "pantry"],
    unreadable_shots: [],
    items: [
      item("whole_wheat_bread", "לחם מלא פרוס", "base"),
      item("pita", "פיתה", "base"),
      item("crackers", "קרקרים", "base", 0.72),
      item("hummus", "חומוס", "spread"),
      item("cream_cheese", "גבינת שמנת", "spread", 0.88, "low"),
      item("chocolate_spread", "ממרח שוקולד", "spread"),
      item("jam", "ריבה", "spread", 0.64),
      item("yellow_cheese", "גבינה צהובה פרוסה", "protein"),
      item("turkey_breast", "חזה הודו פרוס", "protein", 0.81),
      item("hard_boiled_egg", "ביצים", "protein", 0.77),
      item("cucumber", "מלפפון", "side"),
      item("cherry_tomato", "עגבניות שרי", "side"),
      item("bell_pepper", "פלפל", "side", 0.69, "low"),
      item("apple", "תפוחים", "side"),
      item("yoghurt", "יוגורט", "side", 0.83),
      // Deliberately below the review threshold.
      item("pickles", "משהו כבוש", "side", 0.41),
      // Deliberately unmatchable, to exercise the unmatched path.
      item("leftover_cholent", "סיר חמין משבת", "other", 0.55),
    ],
  },
  sparse: {
    shots_processed: ["shelf", "pantry"],
    unreadable_shots: [],
    items: [
      item("white_bread", "לחם לבן פרוס", "base", 0.93, "low"),
      item("margarine", "מרגרינה", "spread", 0.85, "low"),
      item("carrot", "גזרים", "side", 0.79, "low"),
    ],
  },
  nutty: {
    shots_processed: ["shelf", "pantry"],
    unreadable_shots: [],
    items: [
      item("white_bread", "לחם לבן פרוס", "base"),
      item("peanut_butter", "חמאת בוטנים", "spread"),
      item("almond_butter", "חמאת שקדים", "spread", 0.74),
      item("almonds", "שקדים", "side"),
      item("chocolate_spread", "ממרח שוקולד אגוזים", "spread"),
    ],
  },
  unreadable: {
    shots_processed: ["unknown"],
    unreadable_shots: ["דלת המקרר סגורה בתמונה הזו.", "חשוך מדי מכדי לקרוא."],
    items: [],
  },
  // Exercises the fuzzy matcher: slugs no catalog entry matches exactly.
  fuzzy: {
    shots_processed: ["shelf"],
    unreadable_shots: [],
    items: [
      item("sliced_yellow_cheese", "גבינה צהובה פרוסה", "protein"),
      item("whole_wheat_sliced_bread", "לחם מלא", "base"),
      item("baby_cucumbers", "מלפפוני בייבי", "side", 0.86),
    ],
  },
} satisfies Record<string, VisionResult>;

export type FixtureName = keyof typeof FIXTURES;
export const FIXTURE_NAMES = Object.keys(FIXTURES) as FixtureName[];
