import type { Route } from "next";
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

/** רכיבים משותפים — קטנים ובלי דעה משלהם. */

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section
      className={`rise rounded-2xl border border-ink/10 bg-white/70 p-5 shadow-sm ${className}`}
    >
      {children}
    </section>
  );
}

export function PageTitle({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="mb-5">
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      {hint ? <p className="mt-1 text-sm text-ink-soft">{hint}</p> : null}
    </div>
  );
}

type ButtonProps = ComponentProps<"button"> & { variant?: "primary" | "ghost" | "danger" };

export function Button({ variant = "primary", className = "", ...props }: ButtonProps) {
  const styles = {
    primary: "bg-box text-white hover:bg-box-deep",
    ghost: "border border-ink/15 bg-white/60 text-ink hover:bg-white",
    danger: "border border-warn/30 bg-white/60 text-warn hover:bg-warn/5",
  }[variant];

  return (
    <button
      {...props}
      className={`min-h-12 rounded-xl px-4 text-sm font-semibold transition-colors disabled:opacity-50 ${styles} ${className}`}
    />
  );
}

export function Chip({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "warn" | "good";
}) {
  const styles = {
    neutral: "bg-ink/5 text-ink-soft",
    warn: "bg-warn/10 text-warn",
    good: "bg-box/10 text-box-deep",
  }[tone];
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${styles}`}>{children}</span>
  );
}

export function Empty({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: { href: Route; label: string };
}) {
  return (
    <Card className="text-center">
      <p className="font-semibold">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-ink-soft">{body}</p>
      {action ? (
        <Link
          href={action.href}
          className="mt-4 inline-flex min-h-12 items-center rounded-xl bg-box px-4 text-sm font-semibold text-white"
        >
          {action.label}
        </Link>
      ) : null}
    </Card>
  );
}

/**
 * השורה שמופיעה בתחתית כל תוכנית. סינון האלרגנים דטרמיניסטי ומכוסה בבדיקות,
 * אבל ההורה הוא קו ההגנה האחרון — והמוצר אומר את זה במפורש במקום לרמוז
 * שהאפליקציה סגרה את הפינה.
 */
export function SafetyNote() {
  return (
    <p className="mt-4 text-xs leading-relaxed text-ink-soft">
      בוקס באדי מוציא כל מה שמתנגש באיסורים של הילד ובכללים של בית הספר, אבל הוא יודע רק מה
      שסיפרתם לו ומה שראה בתמונות. תעיפו מבט בקופסה לפני שהיא יוצאת מהבית.
    </p>
  );
}
