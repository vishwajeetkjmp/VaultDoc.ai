import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import "./globals.css";
import AdminProvider from "../components/AdminProvider";

const sans = DM_Sans({ subsets: ["latin"], variable: "--font-sans", display: "swap" });

export const metadata: Metadata = {
  title: "VaultDoc Admin",
  robots: { index: false, follow: false },
};

// Saved light/dark choice, applied before the first paint
const applyTheme = `try{if(localStorage.getItem("vaultdoc-admin-theme")==="dark")document.documentElement.dataset.theme="dark"}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={sans.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: applyTheme }} />
      </head>
      <body>
        <AdminProvider>{children}</AdminProvider>
      </body>
    </html>
  );
}
