import { ScanFlow } from "./scan-flow";
import { Card, Empty, PageTitle } from "@/components/ui";
import { LIMITS } from "@/lib/entitlements";
import { loadContext } from "@/lib/session";
import { FIXTURE_NAMES } from "@/lib/vision";

// Every screen reads the household's live state, so nothing here is prerenderable.
export const dynamic = "force-dynamic";

export default async function ScanPage() {
  const ctx = await loadContext();
  if (!ctx) return <Empty title="לא מחוברים" body="התחברו כדי לסרוק את המקרר." />;

  const limits = LIMITS[ctx.household.tier];
  const scansLeft = limits.maxScansPerDay - ctx.usage.scansToday;
  const usingStub = process.env.VISION_PROVIDER !== "anthropic";

  return (
    <>
      <PageTitle
        title="סריקת המקרר"
        hint={
          limits.maxShotsPerScan === 1
            ? "תמונה אחת של המדף שהכי מעניין אתכם."
            : "עד ארבע תמונות: הדלת, המדפים, מגירת הירקות וארגז הלחם."
        }
      />

      {scansLeft <= 0 ? (
        <Card>
          <p className="font-semibold">ניצלתם את הסריקה של היום</p>
          <p className="mt-1 text-sm text-ink-soft">
            המסלול החינמי כולל סריקה אחת ביום. בפרימיום סורקים כמה שרוצים, עד ארבע תמונות בכל
            פעם.
          </p>
        </Card>
      ) : (
        <ScanFlow
          maxShots={limits.maxShotsPerScan}
          usingStub={usingStub}
          fixtures={usingStub ? [...FIXTURE_NAMES] : []}
        />
      )}
    </>
  );
}
