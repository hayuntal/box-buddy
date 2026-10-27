import type { Metadata, Viewport } from "next";
import { Heebo } from "next/font/google";
import "./globals.css";

export const metadata: Metadata = {
  title: "בוקס באדי",
  description: "כריכים לבית הספר, ממה שכבר יש לכם במקרר.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "בוקס באדי", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#f6efe2",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

// Heebo covers Hebrew and Latin in one family, so numerals and brand names
// sit naturally inside Hebrew text.
const heebo = Heebo({ subsets: ["hebrew", "latin"], display: "swap" });

/**
 * Only the document shell. The signed-in chrome — header, bottom nav — lives
 * in `(app)/layout.tsx`, which is also where the session is required, so the
 * sign-in screens cannot accidentally render a nav that leads nowhere.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl" className={heebo.className}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
