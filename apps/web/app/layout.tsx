import type { Metadata } from "next";
import "../styles/globals.css";

export const metadata: Metadata = {
  title: "VaultDocAI — Understand every document in seconds",
  description:
    "AI document intelligence. Upload documents and ask questions in plain language.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-theme="dark">
      <body>{children}</body>
    </html>
  );
}