import { ChildEditor } from "./child-editor";
import { TierSwitch } from "./tier-switch";
import { Card, Chip, Empty, PageTitle } from "@/components/ui";
import { CATALOG } from "@/lib/catalog";
import { LIMITS } from "@/lib/entitlements";
import { allows, loadContext } from "@/lib/session";

const TIER_LABEL = { free: "חינמי", premium: "פרימיום" } as const;

// Every screen reads the household's live state, so nothing here is prerenderable.
export const dynamic = "force-dynamic";

export default async function ChildrenPage() {
  const ctx = await loadContext();
  if (!ctx) return <Empty title="לא מחוברים" body="התחברו כדי לנהל את הפרופילים." />;

  const children = await ctx.repo.listChildren(ctx.session.householdId);
  const canAdd = allows(ctx, { type: "add_child" });

  return (
    <>
      <PageTitle
        title="הילדים"
        hint="אלרגיות וכללי בית ספר הם גבולות מוחלטים — בוקס באדי לעולם לא יתכנן סביבם."
      />

      <div className="space-y-3">
        {children.map((child) => (
          <ChildEditor
            key={child.id}
            child={child}
            ingredients={CATALOG.map((i) => ({ slug: i.slug, displayName: i.displayName }))}
          />
        ))}

        {canAdd ? (
          <ChildEditor
            ingredients={CATALOG.map((i) => ({ slug: i.slug, displayName: i.displayName }))}
          />
        ) : (
          <Card>
            <Chip tone="good">פרימיום</Chip>
            <h2 className="mt-3 font-semibold">ילד אחד במסלול החינמי</h2>
            <p className="mt-1 text-sm text-ink-soft">
              פרימיום מכסה את כל הילדים בבית, לכל אחד האלרגיות, ההעדפות וכללי בית הספר שלו —
              ומאפשר לשני ההורים לחלוק את אותו משק בית.
            </p>
          </Card>
        )}

        <Card>
          <h2 className="text-sm font-bold uppercase tracking-wide text-ink-soft">
            מסלול · {TIER_LABEL[ctx.household.tier]}
          </h2>
          <p className="mt-2 text-sm text-ink-soft">
            {ctx.household.tier === "free"
              ? `${LIMITS.free.maxChildren} ילד, ${LIMITS.free.maxScansPerDay} סריקה ביום, תמונה אחת, בלי תכנון שבועי.`
              : "ילדים ללא הגבלה, סריקות של ארבע תמונות ללא הגבלה, תכנון שבועי ורשימות קניות."}
          </p>
          <TierSwitch tier={ctx.household.tier} />
        </Card>
      </div>
    </>
  );
}
