"use client";

import { useState, useTransition } from "react";
import { removeChild, saveChild } from "@/app/actions";
import { Button, Card, Chip } from "@/components/ui";
import { ALLERGENS, DISLIKE_RULES, SCHOOL_RULES } from "@/lib/domain";
import type { Allergen, Child, DislikeRule, SchoolRule } from "@/lib/domain";
import { DEFAULT_VARIETY } from "@/lib/domain";

const ALLERGEN_LABEL: Record<Allergen, string> = {
  peanut: "בוטנים",
  tree_nut: "אגוזים",
  sesame: "שומשום",
  dairy: "חלב",
  gluten: "גלוטן",
  egg: "ביצים",
  soy: "סויה",
  fish: "דגים",
  shellfish: "פירות ים",
};

const SCHOOL_RULE_LABEL: Record<SchoolRule, string> = {
  nut_free_facility: "בית ספר נטול אגוזים",
  sesame_free: "בלי שומשום",
  dairy_free: "בלי חלב",
  no_meat: "בלי בשר",
};

const DISLIKE_RULE_LABEL: Record<DislikeRule, string> = {
  no_wet_veg_touching_bread: "שום דבר רטוב לא נוגע בלחם",
  no_crusts: "בלי קרום",
  nothing_mixed: "מילוי אחד בלבד, בלי ערבובים",
};

type Ingredient = { slug: string; displayName: string };

function Toggle({
  label,
  active,
  tone = "neutral",
  onClick,
}: {
  label: string;
  active: boolean;
  tone?: "neutral" | "warn";
  onClick: () => void;
}) {
  const activeStyles = tone === "warn" ? "border-warn bg-warn text-white" : "border-box bg-box text-white";
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`min-h-11 rounded-full border px-3.5 text-sm font-semibold transition-colors ${
        active ? activeStyles : "border-ink/15 bg-white/60 text-ink-soft"
      }`}
    >
      {label}
    </button>
  );
}

export function ChildEditor({
  child,
  ingredients,
}: {
  child?: Child;
  ingredients: Ingredient[];
}) {
  const isNew = child === undefined;
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const [name, setName] = useState(child?.name ?? "");
  const [bans, setBans] = useState<Set<Allergen>>(
    new Set(child?.allergies.filter((a) => a.severity === "ban").map((a) => a.allergen)),
  );
  const [avoids, setAvoids] = useState<Set<Allergen>>(
    new Set(child?.allergies.filter((a) => a.severity === "avoid").map((a) => a.allergen)),
  );
  const [schoolRules, setSchoolRules] = useState<Set<SchoolRule>>(new Set(child?.schoolRules));
  const [dislikeRules, setDislikeRules] = useState<Set<DislikeRule>>(
    new Set(child?.dislikes.rules),
  );
  const [dislikes, setDislikes] = useState<Set<string>>(new Set(child?.dislikes.ingredients));
  const [variety, setVariety] = useState(child?.variety ?? DEFAULT_VARIETY);
  const [dislikeQuery, setDislikeQuery] = useState("");

  const toggleIn = <T,>(set: Set<T>, value: T, update: (s: Set<T>) => void) => {
    const nextSet = new Set(set);
    if (nextSet.has(value)) nextSet.delete(value);
    else nextSet.add(value);
    update(nextSet);
  };

  const save = () => {
    startTransition(async () => {
      await saveChild(
        {
          name: name.trim() || "הילד שלי",
          allergies: [
            ...[...bans].map((allergen) => ({ allergen, severity: "ban" as const })),
            ...[...avoids]
              .filter((a) => !bans.has(a))
              .map((allergen) => ({ allergen, severity: "avoid" as const })),
          ],
          dislikeIngredients: [...dislikes],
          dislikeRules: [...dislikeRules],
          variety,
          schoolRules: [...schoolRules],
        },
        child?.id,
      );
      setOpen(false);
      if (isNew) {
        setName("");
        setBans(new Set());
        setAvoids(new Set());
        setSchoolRules(new Set());
        setDislikeRules(new Set());
        setDislikes(new Set());
      }
    });
  };

  if (!open) {
    return (
      <Card>
        {isNew ? (
          <Button variant="ghost" className="w-full" onClick={() => setOpen(true)}>
            + הוספת ילד
          </Button>
        ) : (
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-semibold">{child.name}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {child.allergies.length === 0 && child.schoolRules.length === 0 ? (
                  <Chip>בלי הגבלות</Chip>
                ) : null}
                {child.allergies.map((a) => (
                  <Chip key={a.allergen} tone={a.severity === "ban" ? "warn" : "neutral"}>
                    {a.severity === "ban" ? "בלי " : "להימנע מ"}
                    {ALLERGEN_LABEL[a.allergen]}
                  </Chip>
                ))}
                {child.schoolRules.map((r) => (
                  <Chip key={r} tone="warn">
                    {SCHOOL_RULE_LABEL[r]}
                  </Chip>
                ))}
                {child.dislikes.ingredients.length > 0 ? (
                  <Chip>
                    {child.dislikes.ingredients.length === 1
                      ? "דבר אחד שלא אוהב"
                      : `${child.dislikes.ingredients.length} דברים שלא אוהב`}
                  </Chip>
                ) : null}
              </div>
            </div>
            <Button variant="ghost" className="shrink-0" onClick={() => setOpen(true)}>
              עריכה
            </Button>
          </div>
        )}
      </Card>
    );
  }

  const dislikeMatches = dislikeQuery.trim()
    ? ingredients
        .filter((i) => i.displayName.toLowerCase().includes(dislikeQuery.trim().toLowerCase()))
        .slice(0, 8)
    : [];

  return (
    <Card className="space-y-5">
      <div>
        <label className="text-sm font-bold uppercase tracking-wide text-ink-soft" htmlFor="name">
          שם
        </label>
        <input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="מאיה"
          className="mt-2 min-h-12 w-full rounded-xl border border-ink/15 bg-white/70 px-3 text-base"
        />
      </div>

      <div>
        <p className="text-sm font-bold uppercase tracking-wide text-warn">אף פעם, בשום מצב</p>
        <p className="mt-1 text-xs text-ink-soft">
          איסור מוחלט. שום דבר שמכיל את אלה לא יוצע, אף פעם.
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {ALLERGENS.map((allergen) => (
            <Toggle
              key={allergen}
              label={ALLERGEN_LABEL[allergen]}
              tone="warn"
              active={bans.has(allergen)}
              onClick={() => toggleIn(bans, allergen, setBans)}
            />
          ))}
        </div>
      </div>

      <div>
        <p className="text-sm font-bold uppercase tracking-wide text-ink-soft">מעדיפים שלא</p>
        <p className="mt-1 text-xs text-ink-soft">
          נמנע ככל האפשר, אבל מותר כשאין שום אפשרות אחרת.
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {ALLERGENS.filter((a) => !bans.has(a)).map((allergen) => (
            <Toggle
              key={allergen}
              label={ALLERGEN_LABEL[allergen]}
              active={avoids.has(allergen)}
              onClick={() => toggleIn(avoids, allergen, setAvoids)}
            />
          ))}
        </div>
      </div>

      <div>
        <p className="text-sm font-bold uppercase tracking-wide text-ink-soft">כללי בית הספר</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {SCHOOL_RULES.map((rule) => (
            <Toggle
              key={rule}
              label={SCHOOL_RULE_LABEL[rule]}
              tone="warn"
              active={schoolRules.has(rule)}
              onClick={() => toggleIn(schoolRules, rule, setSchoolRules)}
            />
          ))}
        </div>
      </div>

      <div>
        <p className="text-sm font-bold uppercase tracking-wide text-ink-soft">איך הוא אוכל</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {DISLIKE_RULES.map((rule) => (
            <Toggle
              key={rule}
              label={DISLIKE_RULE_LABEL[rule]}
              active={dislikeRules.has(rule)}
              onClick={() => toggleIn(dislikeRules, rule, setDislikeRules)}
            />
          ))}
        </div>
      </div>

      <div>
        <p className="text-sm font-bold uppercase tracking-wide text-ink-soft">לא מוכן לאכול</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {[...dislikes].map((slug) => (
            <Toggle
              key={slug}
              label={ingredients.find((i) => i.slug === slug)?.displayName ?? slug}
              active
              onClick={() => toggleIn(dislikes, slug, setDislikes)}
            />
          ))}
        </div>
        <input
          value={dislikeQuery}
          onChange={(e) => setDislikeQuery(e.target.value)}
          placeholder="חיפוש משהו שהוא מסרב לאכול…"
          className="mt-2 min-h-12 w-full rounded-xl border border-ink/15 bg-white/70 px-3 text-base"
        />
        {dislikeMatches.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {dislikeMatches.map((i) => (
              <Toggle
                key={i.slug}
                label={i.displayName}
                active={dislikes.has(i.slug)}
                onClick={() => {
                  toggleIn(dislikes, i.slug, setDislikes);
                  setDislikeQuery("");
                }}
              />
            ))}
          </div>
        ) : null}
      </div>

      <div>
        <p className="text-sm font-bold uppercase tracking-wide text-ink-soft">גיוון</p>
        <div className="mt-2 space-y-3">
          <label className="flex items-center justify-between gap-3 text-sm">
            בלי חזרות בתוך
            <select
              value={variety.noRepeatWithinDays}
              onChange={(e) =>
                setVariety({ ...variety, noRepeatWithinDays: Number(e.target.value) })
              }
              className="min-h-11 rounded-xl border border-ink/15 bg-white/70 px-3"
            >
              {[0, 1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n === 0 ? "כבוי" : n === 1 ? "יום" : `${n} ימים`}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center justify-between gap-3 text-sm">
            ממרחים מתוקים בשבוע
            <select
              value={variety.maxSweetPerWeek}
              onChange={(e) =>
                setVariety({ ...variety, maxSweetPerWeek: Number(e.target.value) })
              }
              className="min-h-11 rounded-xl border border-ink/15 bg-white/70 px-3"
            >
              {[0, 1, 2, 3, 5].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center justify-between gap-3 text-sm">
            תמיד לכלול ירק טרי
            <input
              type="checkbox"
              checked={variety.requireFreshVeg}
              onChange={(e) => setVariety({ ...variety, requireFreshVeg: e.target.checked })}
              className="size-5 accent-[var(--color-box)]"
            />
          </label>
        </div>
      </div>

      <div className="flex gap-2">
        <Button className="flex-1" disabled={pending} onClick={save}>
          {isNew ? "הוספת ילד" : "שמירה"}
        </Button>
        <Button variant="ghost" disabled={pending} onClick={() => setOpen(false)}>
          ביטול
        </Button>
        {!isNew ? (
          <Button
            variant="danger"
            disabled={pending}
            onClick={() => startTransition(() => removeChild(child.id))}
          >
            הסרה
          </Button>
        ) : null}
      </div>
    </Card>
  );
}
