import type { Allergen, Category, Ingredient, Trait } from "./domain";

/**
 * The ingredient catalog is the single source of truth for what the app can
 * reason about: the vision model matches into it, the pantry checklist renders
 * from it, and the planner composes from it. `supabase/seed.sql` is generated
 * from this file (`npm run db:seed:gen`), so edit here and never there.
 */

function ing(
  slug: string,
  displayName: string,
  category: Category,
  allergens: Allergen[] = [],
  traits: Trait[] = [],
  isStaple = false,
): Ingredient {
  return { slug, displayName, category, allergens, traits, isStaple };
}

export const CATALOG: readonly Ingredient[] = [
  // ---- Bases -------------------------------------------------------------
  ing("white_bread", "לחם לבן פרוס", "base", ["gluten"], [], true),
  ing("whole_wheat_bread", "לחם מלא פרוס", "base", ["gluten"], [], true),
  ing("rye_bread", "לחם שיפון", "base", ["gluten"]),
  ing("challah", "חלה", "base", ["gluten", "egg"], ["sweet"]),
  ing("pita", "פיתה", "base", ["gluten"], [], true),
  ing("whole_wheat_pita", "פיתה מלאה", "base", ["gluten"]),
  ing("bagel", "בייגל", "base", ["gluten", "sesame"]),
  ing("roll", "לחמנייה", "base", ["gluten"]),
  ing("tortilla", "טורטייה / רפסודה", "base", ["gluten"], [], true),
  ing("corn_tortilla", "טורטיית תירס", "base"),
  ing("gluten_free_bread", "לחם ללא גלוטן", "base"),
  ing("rice_cakes", "פריכיות אורז", "base", [], [], true),
  ing("crackers", "קרקרים", "base", ["gluten"], [], true),
  ing("gf_crackers", "קרקרים ללא גלוטן", "base"),
  ing("croissant", "קרואסון", "base", ["gluten", "dairy"], ["sweet"]),
  ing("english_muffin", "מאפין אנגלי", "base", ["gluten"]),

  // ---- Spreads -----------------------------------------------------------
  ing("butter", "חמאה", "spread", ["dairy"], [], true),
  ing("margarine", "מרגרינה", "spread", [], [], true),
  ing("cream_cheese", "גבינת שמנת", "spread", ["dairy"], [], true),
  ing("hummus", "חומוס", "spread", ["sesame"], [], true),
  ing("tahini", "טחינה", "spread", ["sesame"]),
  ing("mayonnaise", "מיונז", "spread", ["egg"], [], true),
  ing("mustard", "חרדל", "spread"),
  ing("ketchup", "קטשופ", "spread", [], ["sweet"]),
  ing("pesto", "פסטו", "spread", ["dairy", "tree_nut"]),
  ing("jam", "ריבה", "spread", [], ["sweet"], true),
  ing("honey", "דבש", "spread", [], ["sweet"]),
  ing("chocolate_spread", "ממרח שוקולד", "spread", ["dairy", "tree_nut"], ["sweet"], true),
  ing("peanut_butter", "חמאת בוטנים", "spread", ["peanut"], ["sweet"], true),
  ing("almond_butter", "חמאת שקדים", "spread", ["tree_nut"], ["sweet"]),
  ing("avocado_spread", "אבוקדו מעוך", "spread", [], ["fresh_veg"]),
  ing("labneh", "לאבנה", "spread", ["dairy"]),
  ing("olive_oil", "שמן זית", "spread"),

  // ---- Proteins / fillings ----------------------------------------------
  ing("yellow_cheese", "גבינה צהובה פרוסה", "protein", ["dairy"], [], true),
  ing("white_cheese", "גבינה לבנה", "protein", ["dairy"], [], true),
  ing("feta", "פטה", "protein", ["dairy"]),
  ing("mozzarella", "מוצרלה", "protein", ["dairy"]),
  ing("cottage_cheese", "קוטג'", "protein", ["dairy"], ["wet"]),
  ing("hard_boiled_egg", "ביצה קשה", "protein", ["egg"], ["needs_cooking_or_prep"]),
  ing("tuna_salad", "סלט טונה", "protein", ["fish", "egg"], ["wet"]),
  ing("canned_tuna", "טונה משומרת", "protein", ["fish"], ["needs_cooking_or_prep"]),
  ing("turkey_breast", "חזה הודו פרוס", "protein", [], ["meat"], true),
  ing("chicken_breast", "חזה עוף מבושל", "protein", [], ["meat", "needs_cooking_or_prep"]),
  ing("salami", "סלמי", "protein", [], ["meat"]),
  ing("pastrami", "פסטרמה", "protein", [], ["meat"]),
  ing("tofu", "טופו מעושן", "protein", ["soy"]),
  ing("falafel", "כדורי פלאפל", "protein", ["sesame"], ["needs_cooking_or_prep"]),
  ing("egg_salad", "סלט ביצים", "protein", ["egg"], ["wet"]),
  ing("schnitzel", "שניצל עוף", "protein", ["gluten", "egg"], ["meat", "needs_cooking_or_prep"]),

  // ---- Sides: vegetables -------------------------------------------------
  ing("cucumber", "מלפפון", "side", [], ["fresh_veg", "wet"], true),
  ing("cherry_tomato", "עגבניות שרי", "side", [], ["fresh_veg", "wet"], true),
  ing("tomato", "עגבנייה", "side", [], ["fresh_veg", "wet"]),
  ing("carrot", "גזר", "side", [], ["fresh_veg"], true),
  ing("baby_carrots", "גזרי בייבי", "side", [], ["fresh_veg"]),
  ing("bell_pepper", "פלפל", "side", [], ["fresh_veg"], true),
  ing("celery", "סלרי", "side", [], ["fresh_veg"]),
  ing("sugar_snap_peas", "אפונה מתוקה", "side", [], ["fresh_veg"]),
  ing("corn_kernels", "תירס", "side", [], ["fresh_veg", "wet", "sweet"]),
  ing("olives", "זיתים", "side", [], ["wet"], true),
  ing("pickles", "חמוצים", "side", [], ["wet"]),
  ing("lettuce", "חסה", "side", [], ["fresh_veg", "wet"]),
  ing("radish", "צנונית", "side", [], ["fresh_veg"]),

  // ---- Sides: fruit ------------------------------------------------------
  ing("apple", "תפוח", "side", [], ["fruit"], true),
  ing("banana", "בננה", "side", [], ["fruit"], true),
  ing("grapes", "ענבים", "side", [], ["fruit"]),
  ing("clementine", "קלמנטינה", "side", [], ["fruit"]),
  ing("pear", "אגס", "side", [], ["fruit"]),
  ing("strawberries", "תותים", "side", [], ["fruit", "wet"]),
  ing("melon", "מלון", "side", [], ["fruit", "wet"]),
  ing("raisins", "צימוקים", "side", [], ["fruit", "sweet"]),
  ing("dried_apricots", "משמשים מיובשים", "side", [], ["fruit", "sweet"]),

  // ---- Sides: other ------------------------------------------------------
  ing("yoghurt", "יוגורט", "side", ["dairy"], ["wet"], true),
  ing("yoghurt_drink", "יוגורט לשתייה", "side", ["dairy"], ["sweet"]),
  ing("pretzels", "בייגלה", "side", ["gluten"], [], true),
  ing("popcorn", "פופקורן", "side"),
  ing("breadsticks", "מקלות לחם", "side", ["gluten"]),
  ing("granola_bar", "חטיף גרנולה", "side", ["gluten"], ["sweet"]),
  ing("cereal_bar", "חטיף דגנים", "side", ["gluten"], ["sweet"]),
  ing("almonds", "שקדים", "side", ["tree_nut"]),
  ing("walnuts", "אגוזי מלך", "side", ["tree_nut"]),
  ing("sunflower_seeds", "גרעיני חמנייה", "side"),
  ing("hard_pretzel_sticks", "מקלות בייגלה", "side", ["gluten"]),
  ing("cheese_stick", "מקל גבינה", "side", ["dairy"]),
  ing("dark_chocolate_square", "ריבוע שוקולד מריר", "side", ["dairy"], ["sweet"]),
  ing("cookies", "עוגיות", "side", ["gluten", "dairy", "egg"], ["sweet"]),
] as const;

const BY_SLUG = new Map(CATALOG.map((i) => [i.slug, i]));

export function getIngredient(slug: string): Ingredient | undefined {
  return BY_SLUG.get(slug);
}

/** Throws on an unknown slug; use where a missing ingredient is a bug. */
export function requireIngredient(slug: string): Ingredient {
  const found = BY_SLUG.get(slug);
  if (!found) throw new Error(`Unknown ingredient slug: ${slug}`);
  return found;
}

export function byCategory(category: Category): readonly Ingredient[] {
  return CATALOG.filter((i) => i.category === category);
}

export const STAPLES: readonly Ingredient[] = CATALOG.filter((i) => i.isStaple);

export function hasTrait(slug: string, trait: Trait): boolean {
  return getIngredient(slug)?.traits.includes(trait) ?? false;
}
