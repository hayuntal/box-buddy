import { getIngredient, hasTrait } from "@/lib/catalog";
import type { Composition } from "@/lib/domain";

/** מרכיב מהרכב המנה את המשפט שההורה קורא ב-07:00 בבוקר. */

function name(slug: string): string {
  return getIngredient(slug)?.displayName ?? slug;
}

/** "חומוס", "חומוס וגבינה צהובה", "חומוס, מלפפון וגבינה צהובה" */
function list(slugs: readonly string[]): string {
  const names = slugs.map(name);
  if (names.length === 0) return "";
  if (names.length === 1) return names[0]!;
  return `${names.slice(0, -1).join(", ")} ו${names.at(-1)}`;
}

export function renderInstructions(childName: string, c: Composition): string {
  const parts: string[] = [];

  const filling = [...c.spreads, ...c.proteins];
  parts.push(filling.length > 0 ? `${name(c.base)} עם ${list(filling)}` : name(c.base));

  if (c.sides.length > 0) parts.push(`${list(c.sides)} בצד`);
  if (c.separate.length > 0) {
    parts.push(`${list(c.separate)} בקופסה נפרדת כדי שהלחם יישאר יבש`);
  }

  const prep = [c.base, ...filling, ...c.sides, ...c.separate].filter((s) =>
    hasTrait(s, "needs_cooking_or_prep"),
  );
  const sentence = `${childName}: ${parts.join("; ")}.`;
  if (prep.length === 0) return sentence;
  return `${sentence} צריך להכין קודם: ${list(prep)}.`;
}
