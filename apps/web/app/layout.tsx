import type { Metadata, Viewport } from "next";
import { DM_Sans, Newsreader } from "next/font/google";
import "../styles/globals.css";
import { AuthProvider } from "../components/AuthProvider";
import ErrorReporter from "../components/ErrorReporter";
import PwaStart from "../components/PwaStart";
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
  metadataBase: new URL("https://vaultdocai.com"),
  title: "VaultDocAI — A secure and intelligent space for your private documents",
  description:
    "Your private document space with AI. Upload contracts, reports and invoices, ask questions in plain language, get deadline reminders, and use free PDF tools.",
  keywords: ["document AI", "PDF tools", "ask questions about PDF", "Word to PDF", "merge PDF", "secure document storage", "India"],
  // How links look when shared on WhatsApp, LinkedIn, X...
  openGraph: {
    type: "website",
    siteName: "VaultDocAI",
    url: "https://vaultdocai.com",
    title: "VaultDocAI — A secure and intelligent space for your private documents",
    description: "Your private document space with AI: ask questions about your documents, get deadline reminders, free PDF tools.",
    images: [{ url: "/icons/icon-512.png", width: 512, height: 512, alt: "VaultDocAI" }],
    locale: "en_IN",
  },
  twitter: { card: "summary", title: "VaultDocAI", description: "Your private document space with AI." },
  // Installable as an app (see public/manifest.webmanifest and lib/pwa.ts)
  manifest: "/manifest.webmanifest",
  applicationName: "VaultDocAI",
  icons: {
    icon: [
      { url: "/icons/icon.svg", type: "image/svg+xml" },
      { url: "/icons/favicon-48.png", sizes: "48x48", type: "image/png" },
    ],
    apple: { url: "/icons/apple-touch-icon.png", sizes: "180x180" },
  },
  appleWebApp: { capable: true, title: "VaultDoc", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#0a1628",
  // Content can use the full screen of phones with a notch when opened as an app
  viewportFit: "cover",
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
        <ErrorReporter />
        <PwaStart />
      </body>
    </html>
  );
}