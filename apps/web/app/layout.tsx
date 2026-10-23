import type { Metadata } from "next";
import "../styles/globals.css";
import { AuthProvider } from "../components/AuthProvider";
import { THEME_ORDER, THEME_STORAGE_KEY } from "../lib/theme";

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
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: applySavedTheme }} />
      </head>
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}