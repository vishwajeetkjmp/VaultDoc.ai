import type { Metadata } from "next";
import { DM_Sans, Newsreader } from "next/font/google";
import "../styles/globals.css";
import { AuthProvider } from "../components/AuthProvider";
import { THEME_ORDER, THEME_STORAGE_KEY } from "../lib/theme";

// Self-hosted at build time by Next.js (no requests to Google from visitors' browsers)
const sans = DM_Sans({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
// Next.js has no size metrics for Newsreader, so skip its automatic fallback sizing
// (the CSS falls back to Georgia while the font loads)
const serif = Newsreader({
  subsets: ["latin"],
  variable: "--font-serif",
  display: "swap",
  adjustFontFallback: false,
  fallback: ["Georgia", "serif"],
});

export const metadata: Metadata = {
  title: "VaultDocAI — Understand every document in seconds",
  description:
    "AI document intelligence. Upload documents and ask questions in plain language.",
};

// Applies the saved theme before the page paints, on every page (not only where the
// theme menu is), so there's no flash of the default theme.
const applySavedTheme = `try{var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});if(${JSON.stringify(THEME_ORDER)}.indexOf(t)>=0)document.documentElement.setAttribute("data-theme",t)}catch(e){}`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // suppressHydrationWarning: the script above may change data-theme before React loads
    <html lang="en" data-theme="dark" className={`${sans.variable} ${serif.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: applySavedTheme }} />
      </head>
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}