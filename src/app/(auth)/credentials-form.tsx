"use client";

import { useActionState } from "react";
import type { FormState, signIn } from "./actions";
import { Button, Card } from "@/components/ui";

/**
 * Shared by sign-in and sign-up. The two differ only by which fields show and
 * which action runs, and the error comes back from the server rather than
 * being guessed at in the browser.
 */

type Props = {
  action: typeof signIn;
  mode: "signin" | "signup";
  submitLabel: string;
};

const FIELD =
  "min-h-12 w-full rounded-xl border border-ink/15 bg-white/70 px-3 text-sm outline-none focus:border-box focus:ring-2 focus:ring-box/20";

export function CredentialsForm({ action, mode, submitLabel }: Props) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, {});

  return (
    <Card>
      <form action={formAction} className="flex flex-col gap-4">
        {mode === "signup" ? (
          <>
            <label className="flex flex-col gap-1.5 text-sm font-semibold">
              השם שלכם
              <input
                name="displayName"
                autoComplete="name"
                required
                className={FIELD}
                placeholder="מיכל"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-semibold">
              שם המשפחה בבית
              <input
                name="householdName"
                required
                className={FIELD}
                placeholder="משפחת לוי"
              />
            </label>
          </>
        ) : null}

        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          אימייל
          <input
            name="email"
            type="email"
            inputMode="email"
            dir="ltr"
            autoComplete="email"
            required
            defaultValue={state.email ?? ""}
            className={`${FIELD} text-left`}
            placeholder="parent@example.com"
          />
        </label>

        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          סיסמה
          <input
            name="password"
            type="password"
            dir="ltr"
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            required
            minLength={mode === "signup" ? 8 : undefined}
            className={`${FIELD} text-left`}
          />
          {mode === "signup" ? (
            <span className="text-xs font-normal text-ink-soft">8 תווים לפחות.</span>
          ) : null}
        </label>

        {state.error ? (
          <p role="alert" className="rounded-xl bg-warn/10 px-3 py-2 text-sm text-warn">
            {state.error}
          </p>
        ) : null}

        <Button type="submit" disabled={pending}>
          {pending ? "רגע…" : submitLabel}
        </Button>
      </form>
    </Card>
  );
}
