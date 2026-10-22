"use client";

import { useAuth, RequireAuth } from "../../components/AuthProvider";
import ProfileMenu from "../../components/ProfileMenu";
import { getFirstName } from "../../lib/profile";

export default function DashboardPage() {
  return (
    <RequireAuth>
      <Dashboard />
    </RequireAuth>
  );
}

function Dashboard() {
  const { user } = useAuth();

  return (
    <div style={styles.page}>
      <nav style={styles.nav}>
        <div style={styles.navLeft}>
          <div style={styles.logo}>V</div>
          <span style={styles.brand}>VaultDocAI</span>
        </div>
        <div style={styles.navRight}>
          {user && <ProfileMenu user={user} />}
        </div>
      </nav>

      <main style={styles.main}>
        <h1 style={styles.heading}>
          Welcome back{user ? `, ${getFirstName(user)}` : ""} 👋
        </h1>
        <p style={styles.sub}>Here's an overview of your workspace.</p>

        <div style={styles.statsGrid}>
          <StatCard label="Documents" value="0" accent="#6d5cff" />
          <StatCard label="Analyses run" value="0" accent="#38bdf8" />
          <StatCard label="Storage used" value="0 MB" accent="#34d399" />
        </div>

        <h2 style={styles.sectionTitle}>Quick actions</h2>
        <div style={styles.actionsGrid}>
          <ActionCard
            title="Upload a document"
            desc="Add a PDF or image to start analyzing."
            icon="📄"
          />
          <ActionCard
            title="Run analysis"
            desc="Extract insights from your documents with AI."
            icon="✨"
          />
          <ActionCard
            title="View history"
            desc="Browse your past analyses and results."
            icon="🕑"
          />
        </div>
      </main>
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div style={styles.statCard}>
      <div style={{ ...styles.statBar, background: accent }} />
      <div style={styles.statValue}>{value}</div>
      <div style={styles.statLabel}>{label}</div>
    </div>
  );
}

function ActionCard({ title, desc, icon }: { title: string; desc: string; icon: string }) {
  return (
    <div style={styles.actionCard}>
      <div style={styles.actionIcon}>{icon}</div>
      <div style={styles.actionTitle}>{title}</div>
      <div style={styles.actionDesc}>{desc}</div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#0a0e1a",
    fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
    color: "#fff",
  },
  nav: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "16px 32px",
    borderBottom: "1px solid #1c2740",
    background: "#0d1220",
  },
  navLeft: { display: "flex", alignItems: "center", gap: 12 },
  logo: {
    width: 36,
    height: 36,
    borderRadius: 10,
    background: "linear-gradient(135deg,#2563eb,#38bdf8)",
    color: "#fff",
    fontSize: 18,
    fontWeight: 700,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  brand: { fontSize: 17, fontWeight: 700 },
  navRight: { display: "flex", alignItems: "center", gap: 16 },
  main: { maxWidth: 960, margin: "0 auto", padding: "40px 32px" },
  heading: { fontSize: 28, fontWeight: 700, margin: 0 },
  sub: { color: "#8b97b0", fontSize: 15, margin: "8px 0 32px" },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 16,
    marginBottom: 40,
  },
  statCard: {
    background: "#0d1220",
    border: "1px solid #1c2740",
    borderRadius: 14,
    padding: 20,
    position: "relative",
    overflow: "hidden",
  },
  statBar: { position: "absolute", top: 0, left: 0, right: 0, height: 3 },
  statValue: { fontSize: 32, fontWeight: 700 },
  statLabel: { color: "#8b97b0", fontSize: 14, marginTop: 4 },
  sectionTitle: { fontSize: 20, fontWeight: 700, margin: "0 0 16px" },
  actionsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: 16,
  },
  actionCard: {
    background: "#0d1220",
    border: "1px solid #1c2740",
    borderRadius: 14,
    padding: 24,
    cursor: "pointer",
  },
  actionIcon: { fontSize: 28, marginBottom: 12 },
  actionTitle: { fontSize: 16, fontWeight: 700, marginBottom: 6 },
  actionDesc: { color: "#8b97b0", fontSize: 14, lineHeight: 1.5 },
};