import Link from "next/link";

/** The signed-out shell: brand, one card, no navigation to nowhere. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 py-10">
      <Link href="/login" className="mb-6 flex items-center justify-center gap-2">
        <span aria-hidden className="text-3xl">🥪</span>
        <span className="text-xl font-bold tracking-tight">בוקס באדי</span>
      </Link>
      {children}
    </div>
  );
}
