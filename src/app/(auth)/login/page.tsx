import Link from "next/link";
import { redirect } from "next/navigation";
import { signIn } from "../actions";
import { CredentialsForm } from "../credentials-form";
import { getRepo } from "@/lib/db";
import { DEMO_EMAIL, DEMO_PASSWORD } from "@/lib/db/memory";
import { PageTitle } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const repo = getRepo();
  if (await repo.getSession()) redirect("/today");

  return (
    <>
      <PageTitle title="התחברות" hint="הקופסאות של אתמול מחכות לכם." />
      <CredentialsForm action={signIn} mode="signin" submitLabel="כניסה" />

      <p className="mt-4 text-center text-sm text-ink-soft">
        אין לכם חשבון?{" "}
        <Link href="/signup" className="font-semibold text-box-deep underline">
          פתחו אחד
        </Link>
      </p>

      {/* The seeded household is only reachable on the in-process adapter, so
          the hint appears exactly where it is true. */}
      {repo.kind === "memory" ? (
        <p className="mt-6 text-center text-xs leading-relaxed text-ink-soft">
          מצב הדגמה: <span dir="ltr">{DEMO_EMAIL}</span> / <span dir="ltr">{DEMO_PASSWORD}</span>
        </p>
      ) : null}
    </>
  );
}
