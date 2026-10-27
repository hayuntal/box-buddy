import { PantryGrid } from "./pantry-grid";
import { Empty, PageTitle } from "@/components/ui";
import { CATALOG, STAPLES } from "@/lib/catalog";
import { loadContext } from "@/lib/session";

// Every screen reads the household's live state, so nothing here is prerenderable.
export const dynamic = "force-dynamic";

/**
 * מזווה הבסיס. קיים כדי שהאפליקציה תהיה שימושית עוד לפני שמישהו צילם תמונה:
 * מסמנים מה תמיד יש בבית, ולמתכנן יש כבר עם מה לעבוד.
 */

export default async function PantryPage() {
  const ctx = await loadContext();
  if (!ctx) return <Empty title="לא מחוברים" body="התחברו כדי לערוך את המזווה." />;

  const inventory = await ctx.repo.getInventory(ctx.session.householdId);
  const stocked = new Map(inventory.map((i) => [i.slug, i.availability]));

  // קודם מוצרי הבסיס, ואחריהם כל מה שכבר במלאי (נוסף בסריקה).
  const extras = CATALOG.filter((i) => !i.isStaple && stocked.has(i.slug));

  return (
    <>
      <PageTitle
        title="המזווה"
        hint="הקישו על מה שיש לכם בבית. הקשה נוספת מסמנת שהמוצר הולך ונגמר."
      />
      <PantryGrid
        items={[...STAPLES, ...extras].map((i) => ({
          slug: i.slug,
          displayName: i.displayName,
          category: i.category,
        }))}
        stocked={Object.fromEntries(stocked)}
      />
    </>
  );
}
