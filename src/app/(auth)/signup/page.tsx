import Link from "next/link";
import { redirect } from "next/navigation";
import { signUp } from "../actions";
import { CredentialsForm } from "../credentials-form";
import { getRepo } from "@/lib/db";
import { PageTitle } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function SignupPage() {
  if (await getRepo().getSession()) redirect("/today");

  return (
    <>
      <PageTitle
        title="חשבון חדש"
        hint="פותחים משק בית, ואז מוסיפים את הילדים והאיסורים שלהם."
      />
      <CredentialsForm action={signUp} mode="signup" submitLabel="יצירת חשבון" />

      <p className="mt-4 text-center text-sm text-ink-soft">
        יש לכם כבר חשבון?{" "}
        <Link href="/login" className="font-semibold text-box-deep underline">
          התחברו
        </Link>
      </p>
    </>
  );
}
