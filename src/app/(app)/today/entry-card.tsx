"use client";

import { useState, useTransition } from "react";
import { setEntryStatus } from "@/app/actions";
import { Button, Card, Chip } from "@/components/ui";
import { getIngredient } from "@/lib/catalog";
import type { StoredPlanEntry } from "@/lib/db";
import type { Allergen, Child } from "@/lib/domain";

/** התווית הקצרה שמופיעה על הכרטיס, לצד שם הילד. */
const ALLERGEN_SHORT: Record<Allergen, string> = {
  peanut: "בלי בוטנים",
  tree_nut: "בלי אגוזים",
  sesame: "בלי שומשום",
  dairy: "בלי חלב",
  gluten: "בלי גלוטן",
  egg: "בלי ביצים",
  soy: "בלי סויה",
  fish: "בלי דגים",
  shellfish: "בלי פירות ים",
};

const REJECT_REASONS = [
  { value: "disliked", label: "הוא לא יאכל את זה" },
  { value: "not_available", label: "אין לנו את זה בפועל" },
  { value: "too_much_work", label: "אין זמן להכין את זה" },
] as const;

export function EntryCard({
  entry,
  child,
}: {
  entry: StoredPlanEntry;
  child: Child | undefined;
}) {
  const [pending, startTransition] = useTransition();
  const [rejecting, setRejecting] = useState(false);

  const act = (status: StoredPlanEntry["status"], reason?: string) => {
    startTransition(async () => {
      await setEntryStatus(entry.id, status, reason);
      setRejecting(false);
    });
  };

  if (!entry.composition) {
    return (
      <Card>
        <div className="flex items-start justify-between gap-3">
          <p className="font-semibold">{child?.name ?? "הילד"}</p>
          <Chip tone="warn">אין ממה להכין בבטחה</Chip>
        </div>
        <p className="mt-2 text-sm text-ink-soft">{entry.instructions}</p>
        {entry.shortfall ? (
          <p className="mt-3 text-sm">
            קניית אחד מאלה תפתור את זה:{" "}
            <span className="font-semibold">
              {entry.shortfall.suggestions
                .map((s) => getIngredient(s)?.displayName ?? s)
                .join(", ")}
            </span>
            .
          </p>
        ) : null}
      </Card>
    );
  }

  const packed = entry.status === "packed";

  return (
    <Card className={packed ? "opacity-70" : ""}>
      <div className="flex items-start justify-between gap-3">
        <p className="font-semibold">{child?.name ?? "הילד"}</p>
        <div className="flex shrink-0 gap-1.5">
          {child?.allergies
            .filter((a) => a.severity === "ban")
            .map((a) => (
              <Chip key={a.allergen} tone="warn">
                {ALLERGEN_SHORT[a.allergen]}
              </Chip>
            ))}
          {packed ? <Chip tone="good">ארוז</Chip> : null}
        </div>
      </div>

      <p className="mt-2 text-[15px] leading-relaxed">{entry.instructions}</p>

      {rejecting ? (
        <div className="mt-4 space-y-2">
          <p className="text-sm font-semibold">מה לא עבד?</p>
          {REJECT_REASONS.map((reason) => (
            <Button
              key={reason.value}
              variant="ghost"
              className="w-full"
              disabled={pending}
              onClick={() => act("rejected", reason.value)}
            >
              {reason.label}
            </Button>
          ))}
          <Button variant="ghost" className="w-full" onClick={() => setRejecting(false)}>
            לא משנה
          </Button>
        </div>
      ) : (
        <div className="mt-4 flex gap-2">
          <Button
            className="flex-1"
            disabled={pending || packed}
            onClick={() => act("packed")}
          >
            {packed ? "ארוז" : "ארזתי"}
          </Button>
          <Button variant="ghost" disabled={pending} onClick={() => setRejecting(true)}>
            לא את זה
          </Button>
        </div>
      )}
    </Card>
  );
}
