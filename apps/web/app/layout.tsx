import type { Metadata } from "next";
import "../styles/globals.css";
import { AuthProvider } from "../components/AuthProvider";

export const metadata: Metadata = {
  title: "VaultDocAI — Understand every document in seconds",
  description:
    "AI document intelligence. Upload documents and ask questions in plain language.",
};

// Applies the saved theme before the page paints, on every page (not only where the
// theme toggle is), so there's no flash of the default theme. Keep the storage key
// and theme names in sync with lib/theme.ts.
const applySavedTheme = `try{var t=localStorage.getItem("vaultdocai-theme");if(t==="grey"||t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}`;

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