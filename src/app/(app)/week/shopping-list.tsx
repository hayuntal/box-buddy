"use client";

import { useOptimistic, useState, useTransition } from "react";
import { toggleShoppingItem } from "@/app/actions";
import { Button, Card } from "@/components/ui";
import { asPlainText, type ShoppingItem } from "@/lib/shopping";

const REASON_LABEL: Record<ShoppingItem["reason"], string> = {
  needed_for_shortfall: "יפתור חסימה של ילד",
  out_of_stock: "לא נמצא במקרר",
  running_low: "הולך ונגמר",
};

export function ShoppingList({
  planId,
  items,
}: {
  planId: string;
  items: readonly ShoppingItem[];
}) {
  const [, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);
  const [checked, setChecked] = useOptimistic(
    new Set(items.filter((i) => i.checked).map((i) => i.slug)),
    (state: Set<string>, slug: string) => {
      const nextState = new Set(state);
      if (nextState.has(slug)) nextState.delete(slug);
      else nextState.add(slug);
      return nextState;
    },
  );

  if (items.length === 0) {
    return (
      <Card>
        <p className="font-semibold">אין מה לקנות</p>
        <p className="mt-1 text-sm text-ink-soft">
          כל מה שהתוכנית של השבוע צריכה כבר נמצא בבית.
        </p>
      </Card>
    );
  }

  const copy = async () => {
    await navigator.clipboard.writeText(asPlainText(items));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card>
      <h2 className="font-semibold">רשימת קניות</h2>
      <ul className="mt-3 space-y-1">
        {items.map((item) => {
          const isChecked = checked.has(item.slug);
          return (
            <li key={item.slug}>
              <label className="flex min-h-11 cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() =>
                    startTransition(async () => {
                      setChecked(item.slug);
                      await toggleShoppingItem(planId, item.slug, !isChecked);
                    })
                  }
                  className="size-5 shrink-0 accent-[var(--color-box)]"
                />
                <span className={isChecked ? "text-ink-soft line-through" : ""}>
                  {item.displayName}
                </span>
                <span className="ml-auto shrink-0 text-xs text-ink-soft">
                  {REASON_LABEL[item.reason]}
                </span>
              </label>
            </li>
          );
        })}
      </ul>

      <Button variant="ghost" className="mt-3" onClick={copy}>
        {copied ? "הועתק" : "העתקת הרשימה"}
      </Button>
    </Card>
  );
}
