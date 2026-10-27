import Link from "next/link";
import { generateRescue, generateToday } from "@/app/actions";
import { EntryCard } from "./entry-card";
import { Button, Card, Empty, PageTitle, SafetyNote } from "@/components/ui";
import { loadContext } from "@/lib/session";

// Every screen reads the household's live state, so nothing here is prerenderable.
export const dynamic = "force-dynamic";

/** מצב בהלת הבוקר: לחיצה אחת, כל הילדים, מה להכין עכשיו. */

export default async function TodayPage() {
  const ctx = await loadContext();
  if (!ctx) {
    return <Empty title="לא מחוברים" body="התחברו כדי לראות את הקופסאות של היום." />;
  }

  const [children, inventory, plan] = await Promise.all([
    ctx.repo.listChildren(ctx.session.householdId),
    ctx.repo.getInventory(ctx.session.householdId),
    ctx.repo.getLatestPlan(ctx.session.householdId, "daily"),
  ]);

  const today = new Date().toISOString().slice(0, 10);
  const rescue = await ctx.repo.getLatestPlan(ctx.session.householdId, "rescue");
  const current =
    plan?.startDate === today
      ? plan
      : rescue?.startDate === today
        ? rescue
        : null;

  if (children.length === 0) {
    return (
      <>
        <PageTitle title="היום" />
        <Empty
          title="עוד אין ילדים"
          body="הוסיפו ילד, עם האלרגיות שלו והכללים של בית הספר, ובוקס באדי יתחיל לתכנן."
          action={{ href: "/children", label: "הוספת ילד" }}
        />
      </>
    );
  }

  if (inventory.length === 0) {
    return (
      <>
        <PageTitle title="היום" />
        <Empty
          title="בוקס באדי לא יודע מה יש לכם"
          body="סרקו את המקרר, או סמנו את המוצרים שתמיד יש בבית, ומשם התוכנית היא לחיצה אחת."
          action={{ href: "/scan", label: "סריקת המקרר" }}
        />
      </>
    );
  }

  const childById = new Map(children.map((c) => [c.id, c]));
  const stockLow = inventory.filter((i) => i.availability !== "out").length <= 4;

  return (
    <>
      <PageTitle
        title="היום"
        hint={new Date().toLocaleDateString("he-IL", {
          weekday: "long",
          day: "numeric",
          month: "long",
        })}
      />

      {current === null ? (
        <Card className="text-center">
          <p className="font-semibold">מוכן כשתהיו</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-ink-soft">
            {children.length === 1
              ? `קופסה אחת ל${children[0]!.name}, מתוך ${inventory.length} מוצרים שיש לכם בבית.`
              : `${children.length} קופסאות, מתוך ${inventory.length} מוצרים שיש לכם בבית.`}
          </p>
          <form action={generateToday} className="mt-4">
            <Button type="submit" className="w-full sm:w-auto sm:px-8">
              תכנון הקופסאות של היום
            </Button>
          </form>
          {stockLow ? (
            <form action={generateRescue} className="mt-2">
              <Button type="submit" variant="ghost" className="w-full sm:w-auto">
                המקרר כמעט ריק — תצילו אותי
              </Button>
            </form>
          ) : null}
        </Card>
      ) : (
        <div className="space-y-3">
          {current.mode === "rescue" ? (
            <p className="text-sm font-semibold text-warn">
              תוכנית חילוץ — מורכבת מהדברים האחרונים שנשארו במקרר.
            </p>
          ) : null}

          {current.entries.map((entry) => (
            <EntryCard
              key={entry.id}
              entry={entry}
              child={childById.get(entry.childId)}
            />
          ))}

          <div className="flex flex-wrap gap-2 pt-1">
            <form action={generateToday}>
              <Button type="submit" variant="ghost">
                תכנון מחדש
              </Button>
            </form>
            <form action={generateRescue}>
              <Button type="submit" variant="ghost">
                מצב חילוץ
              </Button>
            </form>
            <Link
              href="/week"
              className="flex min-h-12 items-center rounded-xl border border-ink/15 bg-white/60 px-4 text-sm font-semibold"
            >
              תכנון השבוע
            </Link>
          </div>

          <SafetyNote />
        </div>
      )}
    </>
  );
}
