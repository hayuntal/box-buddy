import { generateWeek } from "@/app/actions";
import { ShoppingList } from "./shopping-list";
import { Button, Card, Chip, Empty, PageTitle, SafetyNote } from "@/components/ui";
import { loadContext, allows } from "@/lib/session";

// Every screen reads the household's live state, so nothing here is prerenderable.
export const dynamic = "force-dynamic";

/** מצב הכנה שבועית: חמישה ימי לימודים במכה אחת, ועוד רשימה של מה שחסר. */

function dayLabel(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("he-IL", {
    weekday: "long",
    timeZone: "UTC",
  });
}

export default async function WeekPage() {
  const ctx = await loadContext();
  if (!ctx) return <Empty title="לא מחוברים" body="התחברו כדי לתכנן את השבוע." />;

  const canPlanWeek = allows(ctx, { type: "plan_week" });
  const canSeeList = allows(ctx, { type: "view_shopping_list" });

  if (!canPlanWeek) {
    return (
      <>
        <PageTitle title="השבוע" />
        <Card>
          <Chip tone="good">פרימיום</Chip>
          <h2 className="mt-3 font-semibold">לתכנן ביום ראשון את כל חמשת ימי הלימודים</h2>
          <p className="mt-1 text-sm text-ink-soft">
            בוקס באדי מפזר את הגיוון על פני השבוע, שומר על מכסת הממרחים המתוקים של כל ילד, ואוסף
            את כל מה שחסר לרשימת קניות אחת.
          </p>
        </Card>
      </>
    );
  }

  const [children, plan] = await Promise.all([
    ctx.repo.listChildren(ctx.session.householdId),
    ctx.repo.getLatestPlan(ctx.session.householdId, "weekly"),
  ]);

  if (!plan) {
    return (
      <>
        <PageTitle title="השבוע" />
        <Card className="text-center">
          <p className="font-semibold">תכנון שבוע הלימודים הקרוב</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-ink-soft">
            חמישה ימים ל{children.length === 1 ? children[0]!.name : `־${children.length} ילדים`},
            בלי חזרות, ועם רשימת קניות לפערים.
          </p>
          <form action={generateWeek} className="mt-4">
            <Button type="submit" className="w-full sm:w-auto sm:px-8">
              תכנון השבוע
            </Button>
          </form>
        </Card>
      </>
    );
  }

  const childById = new Map(children.map((c) => [c.id, c]));
  const days = [...new Set(plan.entries.map((e) => e.date))].sort();

  return (
    <>
      <PageTitle title="השבוע" hint={`מ${dayLabel(plan.startDate)}`} />

      <div className="space-y-3">
        {days.map((date) => (
          <Card key={date}>
            <h2 className="text-sm font-bold uppercase tracking-wide text-ink-soft">
              {dayLabel(date)}
            </h2>
            <ul className="mt-2 space-y-2">
              {plan.entries
                .filter((e) => e.date === date)
                .map((entry) => (
                  <li key={entry.id} className="text-[15px] leading-relaxed">
                    {entry.composition ? (
                      entry.instructions
                    ) : (
                      <span className="text-warn">
                        {childById.get(entry.childId)?.name ?? "הילד"}: אין במלאי משהו בטוח
                      </span>
                    )}
                  </li>
                ))}
            </ul>
          </Card>
        ))}

        {canSeeList ? (
          <ShoppingList planId={plan.id} items={plan.shopping} />
        ) : null}

        <form action={generateWeek}>
          <Button type="submit" variant="ghost">
            תכנון מחדש
          </Button>
        </form>

        <SafetyNote />
      </div>
    </>
  );
}
