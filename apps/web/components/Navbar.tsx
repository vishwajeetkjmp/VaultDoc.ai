"use client";

import ToolDropdown from "./ToolDropdown";
import ThemeToggle from "./ThemeToggle";

export default function Navbar() {
  return (
    <nav
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "16px 32px",
        borderBottom: "1px solid var(--border)",
        background: "var(--bg-elevated)",
        position: "sticky",
        top: 0,
        zIndex: 100,
      }}
    >
      {/* Left: logo */}
      <a
        href="/"
        style={{
          fontSize: "20px",
          fontWeight: 700,
          display: "flex",
          alignItems: "center",
          gap: "8px",
        }}
      >
        <span style={{ color: "var(--primary)" }}>🔒</span>
        VaultDocAI
      </a>

      {/* Center: nav links */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "28px",
        }}
      >
        <ToolDropdown />
        <a href="/pricing" style={{ fontSize: "15px", fontWeight: 500 }}>
          Pricing
        </a>
        <a href="/about" style={{ fontSize: "15px", fontWeight: 500 }}>
          About
        </a>
      </div>

      {/* Right: auth + theme */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
        }}
      >
        <a
          href="/signin"
          style={{
            fontSize: "15px",
            fontWeight: 500,
            padding: "8px 16px",
          }}
        >
          Sign In
        </a>
        <a
          href="/signup"
          style={{
            background: "var(--primary)",
            color: "#fff",
            fontSize: "15px",
            fontWeight: 600,
            padding: "9px 18px",
            borderRadius: "8px",
          }}
        >
          Sign Up
        </a>
        <ThemeToggle />
      </div>
    </nav>
  );
}