"use client";

import { useState, useTransition } from "react";
import { applyScan, runScan } from "@/app/actions";
import { Button, Card, Chip } from "@/components/ui";
import type { NormalizedScan } from "@/lib/vision";
import type { FixtureName } from "@/lib/vision";
import { downscaleToJpeg, type Shot } from "@/lib/vision/downscale";

const SHOT_LABELS = ["דלת המקרר", "המדפים", "מגירת הירקות", "לחם ומזווה"] as const;

/** שמות נתוני הדוגמה, לכלי הפיתוח בלבד. */
const FIXTURE_LABEL: Record<FixtureName, string> = {
  full: "מקרר מלא",
  sparse: "מקרר דליל",
  nutty: "הכול אגוזים",
  unreadable: "תמונות לא קריאות",
  fuzzy: "התאמה מקורבת",
};

type Reviewed = { slug: string; displayName: string; availability: "plenty" | "low"; keep: boolean };

/**
 * צילום ← אישור ← החלה. שלב האישור הוא כל העניין: סריקה היא הצעה שההורה מתקן
 * בהקשה אחת, ולא כתיבה שקטה למלאי שלו.
 */
export function ScanFlow({
  maxShots,
  usingStub,
  fixtures,
}: {
  maxShots: number;
  usingStub: boolean;
  fixtures: FixtureName[];
}) {
  const [pending, startTransition] = useTransition();
  const [photos, setPhotos] = useState<Record<number, Shot>>({});
  const [fixture, setFixture] = useState<FixtureName>("full");
  const [scan, setScan] = useState<NormalizedScan | null>(null);
  const [reviewed, setReviewed] = useState<Reviewed[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState(false);

  const onPick = async (index: number, file: File | undefined) => {
    if (!file) return;
    try {
      const shot = await downscaleToJpeg(file);
      setPhotos((p) => ({ ...p, [index]: shot }));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "לא הצלחנו לקרוא את התמונה.");
    }
  };

  const start = () => {
    setError(null);
    startTransition(async () => {
      try {
        const shots = Object.entries(photos).map(([slot, shot]) => ({
          base64: shot.base64,
          mediaType: shot.mediaType,
          slot: Number(slot),
        }));
        const result = await runScan(shots, usingStub ? fixture : undefined);
        setScan(result);
        setReviewed([
          ...result.confirmed.map((i) => ({ ...i, keep: true })),
          ...result.needsReview.map((i) => ({ ...i, keep: false })),
        ]);
      } catch (e) {
        setError(e instanceof Error ? e.message : "הסריקה נכשלה.");
      }
    });
  };

  const apply = () => {
    startTransition(async () => {
      await applyScan(
        reviewed
          .filter((r) => r.keep)
          .map((r) => ({
            slug: r.slug,
            availability: r.availability,
            source: "scan" as const,
          })),
      );
      setApplied(true);
    });
  };

  if (applied) {
    return (
      <Card className="text-center">
        <p className="font-semibold">המקרר עודכן</p>
        <p className="mt-1 text-sm text-ink-soft">
          {reviewed.filter((r) => r.keep).length} מוצרים נמצאים עכשיו במלאי שלכם.
        </p>
        <Button className="mt-4" onClick={() => location.assign("/today")}>
          תכנון הקופסאות של היום
        </Button>
      </Card>
    );
  }

  if (scan) {
    return (
      <div className="space-y-3">
        <Card>
          <h2 className="font-semibold">זה נראה נכון?</h2>
          <p className="mt-1 text-sm text-ink-soft">
            הקישו על כל מה שלא באמת נמצא שם כדי להוריד אותו. מה שלא מסומן היה ניחוש.
          </p>

          <ul className="mt-4 flex flex-wrap gap-2">
            {reviewed.map((item, index) => (
              <li key={item.slug}>
                <button
                  type="button"
                  aria-pressed={item.keep}
                  onClick={() =>
                    setReviewed((rs) =>
                      rs.map((r, i) => (i === index ? { ...r, keep: !r.keep } : r)),
                    )
                  }
                  className={`min-h-11 rounded-full border px-3.5 text-sm font-semibold transition-colors ${
                    item.keep
                      ? "border-box bg-box text-white"
                      : "border-dashed border-ink/25 bg-white/60 text-ink-soft"
                  }`}
                >
                  {item.displayName}
                  {item.availability === "low" ? " · נגמר" : ""}
                </button>
              </li>
            ))}
          </ul>

          {scan.unmatched.length > 0 ? (
            <p className="mt-4 text-xs text-ink-soft">
              התעלמנו מאלה, כי הם לא אוכל לקופסה:{" "}
              {scan.unmatched.map((u) => u.displayName).join(", ")}.
            </p>
          ) : null}

          {scan.unreadableShots.length > 0 ? (
            <div className="mt-4 space-y-1">
              {scan.unreadableShots.map((reason) => (
                <p key={reason} className="text-xs text-warn">
                  לא הצלחנו לקרוא תמונה: {reason}
                </p>
              ))}
            </div>
          ) : null}
        </Card>

        <div className="flex gap-2">
          <Button className="flex-1" disabled={pending} onClick={apply}>
            שמירת {reviewed.filter((r) => r.keep).length} מוצרים
          </Button>
          <Button variant="ghost" disabled={pending} onClick={() => setScan(null)}>
            סריקה מחדש
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Card>
        <div className="grid grid-cols-2 gap-3">
          {SHOT_LABELS.slice(0, maxShots).map((label, index) => (
            <label
              key={label}
              className="flex min-h-28 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-ink/25 bg-white/50 p-3 text-center"
            >
              {photos[index] ? (
                // Object URLs from the camera; next/image adds nothing here.
                <img
                  src={photos[index].previewUrl}
                  alt={label}
                  className="h-20 w-full rounded-lg object-cover"
                />
              ) : (
                <>
                  <span aria-hidden className="text-2xl">
                    📷
                  </span>
                  <span className="text-xs font-semibold text-ink-soft">{label}</span>
                </>
              )}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="sr-only"
                onChange={(e) => onPick(index, e.target.files?.[0])}
              />
            </label>
          ))}
        </div>

        {usingStub ? (
          <div className="mt-4 rounded-xl bg-ink/5 p-3">
            <p className="text-xs font-semibold">
              <Chip>פיתוח</Chip> לא מוגדר מודל ראייה, ולכן נעשה שימוש בנתוני דוגמה.
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {fixtures.map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => setFixture(name)}
                  className={`min-h-9 rounded-full px-3 text-xs font-semibold ${
                    fixture === name ? "bg-box text-white" : "bg-white/70 text-ink-soft"
                  }`}
                >
                  {FIXTURE_LABEL[name]}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </Card>

      {error ? <p className="text-sm font-semibold text-warn">{error}</p> : null}

      <Button
        className="w-full"
        disabled={pending || (!usingStub && Object.keys(photos).length === 0)}
        onClick={start}
      >
        {pending ? "קוראים את המקרר…" : "קראו לי את המקרר"}
      </Button>
    </div>
  );
}
