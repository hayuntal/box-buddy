import Link from "next/link";
import { redirect } from "next/navigation";
import { signOut } from "@/app/(auth)/actions";
import { loadContext } from "@/lib/session";

/**
 * The gate. Every screen under this layout needs a signed-in parent, so the
 * check happens once here instead of being repeated — and forgotten — per
 * page. The Server Actions check again on their own: a layout guards what is
 * rendered, never what can be called.
 */

const NAV = [
  { href: "/today", label: "היום" },
  { href: "/week", label: "השבוע" },
  { href: "/scan", label: "סריקה" },
  { href: "/pantry", label: "המזווה" },
  { href: "/children", label: "ילדים" },
] as const;

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await loadContext();
  if (!ctx) redirect("/login");

  return (
    <>
      <div className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col px-4 pb-28">
        <header className="flex items-center justify-between gap-3 py-5">
          <Link href="/today" className="flex items-center gap-2">
            <span aria-hidden className="text-2xl">🥪</span>
            <span className="text-lg font-bold tracking-tight">בוקס באדי</span>
          </Link>

          <div className="flex items-center gap-2 text-xs text-ink-soft">
            <span className="hidden sm:inline">{ctx.session.displayName}</span>
            <form action={signOut}>
              <button
                type="submit"
                className="min-h-9 rounded-lg border border-ink/15 bg-white/60 px-3 font-semibold text-ink-soft transition-colors hover:bg-white"
              >
                יציאה
              </button>
            </form>
          </div>
        </header>
        <main className="flex-1">{children}</main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 border-t border-ink/10 bg-crust/90 backdrop-blur">
        <ul className="mx-auto flex w-full max-w-2xl items-stretch justify-between px-2 pb-[env(safe-area-inset-bottom)]">
          {NAV.map((item) => (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                className="flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-xl px-2 text-xs font-semibold text-ink-soft transition-colors hover:bg-ink/5 hover:text-ink"
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
