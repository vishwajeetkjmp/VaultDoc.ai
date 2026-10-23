"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { can, type Role } from "../lib/api";
import { useAdmin } from "./AdminProvider";

const NAV: { href: string; label: string; min: Role; icon: string; section?: string }[] = [
  { href: "/", label: "Overview", min: "viewer", icon: "M4 13h6V4H4zM14 20h6v-9h-6zM4 20h6v-3H4zM14 7h6V4h-6z" },
  { href: "/users/", label: "Users", min: "support", icon: "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21a7 7 0 0 1 14 0M17 3.5a4 4 0 0 1 0 7.5M22 21a7 7 0 0 0-4-6.3", section: "Manage" },
  { href: "/shares/", label: "Shares", min: "support", icon: "M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1" },
  { href: "/abuse/", label: "Abuse", min: "support", icon: "M12 3 2 20h20zM12 10v4M12 17h.01" },
  { href: "/audit/", label: "Audit log", min: "support", icon: "M8 4h10a2 2 0 0 1 2 2v14l-3-2-3 2-3-2-3 2V6a2 2 0 0 1 2-2zM9 9h8M9 13h6" },
  { href: "/team/", label: "Team", min: "owner", icon: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z", section: "Settings" },
  { href: "/system/", label: "System", min: "viewer", icon: "M4 6h16v5H4zM4 14h16v5H4zM8 8.5h.01M8 16.5h.01" },
];

const ROLE_LABEL: Record<Role, string> = { owner: "Owner", support: "Support", viewer: "Viewer" };

function Icon({ d }: { d: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}

/** Admin layout: role-aware sidebar, sticky top bar with the page title and actions. */
export default function Shell({ title, actions, children }: { title: string; actions?: React.ReactNode; children: React.ReactNode }) {
  const { user, role, logout } = useAdmin();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => setTheme(document.documentElement.dataset.theme === "dark" ? "dark" : "light"), []);
  useEffect(() => setOpen(false), [pathname]);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("vaultdoc-admin-theme", next);
    } catch {}
  };

  const current = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href.replace(/\/$/, "")));

  return (
    <div className="shell">
      <aside className={`sidebar${open ? " open" : ""}`}>
        <div className="brand">
          <span className="brandMark">🔒</span>
          <span>
            VaultDoc
            <small>Admin</small>
          </span>
        </div>
        {NAV.filter((n) => can(role, n.min)).map((n) => (
          <div key={n.href}>
            {n.section && <div className="navSection">{n.section}</div>}
            <Link href={n.href} className="nav" aria-current={current(n.href) ? "page" : undefined}>
              <Icon d={n.icon} />
              {n.label}
            </Link>
          </div>
        ))}
        <div className="sidebarFoot">
          <div className="ellipsis" title={user.email ?? ""} style={{ color: "var(--text)", fontWeight: 550 }}>
            {user.email}
          </div>
          <div className="row" style={{ marginTop: 6, justifyContent: "space-between" }}>
            <span className="badge info">{ROLE_LABEL[role]}</span>
            <button className="btn btnGhost btnSm" onClick={logout}>
              Log out
            </button>
          </div>
        </div>
      </aside>
      {open && <div className="overlay" style={{ zIndex: 35 }} onClick={() => setOpen(false)} />}

      <div className="main">
        <header className="topbar">
          <button className="btn btnGhost menuToggle" onClick={() => setOpen(true)} aria-label="Open menu">
            ☰
          </button>
          <h1>{title}</h1>
          <span className="spacer" />
          {actions}
          <button className="btn btnGhost" onClick={toggleTheme} aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`} title="Light / dark">
            {theme === "dark" ? "☀︎" : "☾"}
          </button>
        </header>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}

/** Pages for a higher role show this instead of their content. */
export function RoleGate({ min, children }: { min: Role; children: React.ReactNode }) {
  const { role } = useAdmin();
  if (can(role, min)) return <>{children}</>;
  return <div className="card empty">You need the {ROLE_LABEL[min]} role to see this page.</div>;
}
