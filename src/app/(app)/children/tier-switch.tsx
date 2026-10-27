"use client";

import { useTransition } from "react";
import { setTier } from "@/app/actions";
import { Button } from "@/components/ui";

/**
 * ממלא את מקום החיוב. עד שיחובר Stripe, המסלול הוא עמודה בבסיס הנתונים,
 * וזו הדרך לראות את שני צדי הפיי-וול.
 */
export function TierSwitch({ tier }: { tier: "free" | "premium" }) {
  const [pending, startTransition] = useTransition();
  const target = tier === "free" ? "premium" : "free";

  return (
    <Button
      variant="ghost"
      className="mt-3"
      disabled={pending}
      onClick={() => startTransition(() => setTier(target))}
    >
      מעבר ל{target === "premium" ? "פרימיום" : "חינמי"} (עדיין בלי תשלום)
    </Button>
  );
}
