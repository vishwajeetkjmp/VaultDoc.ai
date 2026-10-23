"use client";

import { useCallback, useEffect, useState } from "react";
import { useAdmin } from "../../components/AdminProvider";
import Shell, { RoleGate } from "../../components/Shell";
import { Card, ReasonDialog, SkeletonRows } from "../../components/ui";
import { adminApi, errorText, type Role } from "../../lib/api";
import { date } from "../../lib/format";

type Member = { uid: string; email: string; role: Role; addedBy: string; at: number | null };
const ROLE_TEXT: Record<Role, string> = {
  owner: "Everything, including the team and deleting accounts",
  support: "Users, shares, abuse and the audit log; can't delete accounts or manage the team",
  viewer: "Overview and System pages only (read-only)",
};

export default function TeamPage() {
  return (
    <Shell title="Team">
      <RoleGate min="owner">
        <Team />
      </RoleGate>
    </Shell>
  );
}

function Team() {
  const { user, toast } = useAdmin();
  const [members, setMembers] = useState<Member[] | null>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("support");
  const [pending, setPending] = useState<{ email: string; role: Role | null } | null>(null);

  const load = useCallback(async () => {
    try {
      setMembers((await adminApi<{ members: Member[] }>("team")).members.sort((a, b) => (a.role === "owner" ? -1 : b.role === "owner" ? 1 : a.email.localeCompare(b.email))));
    } catch (e) {
      toast(errorText(e), true);
      setMembers([]);
    }
  }, [toast]);
  useEffect(() => void load(), [load]);

  return (
    <div className="grid">
      <Card title="Add a team member" subtitle="They must log in to VaultDoc with Google once before you add them. The role applies at their next login.">
        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault();
            if (email.trim()) setPending({ email: email.trim().toLowerCase(), role });
          }}
        >
          <input className="input" type="email" required placeholder="name@company.com" value={email} onChange={(e) => setEmail(e.target.value)} style={{ flex: 1, minWidth: 220, maxWidth: 360 }} aria-label="Email" />
          <select className="select" value={role} onChange={(e) => setRole(e.target.value as Role)} aria-label="Role">
            <option value="support">Support</option>
            <option value="viewer">Viewer</option>
            <option value="owner">Owner</option>
          </select>
          <button className="btn btnPrimary" type="submit">
            Add
          </button>
        </form>
        <div className="grid" style={{ marginTop: 14, gap: 6 }}>
          {(Object.keys(ROLE_TEXT) as Role[]).map((r) => (
            <div key={r} className="small">
              <span className="badge info" style={{ minWidth: 64, justifyContent: "center" }}>
                {r}
              </span>{" "}
              <span className="muted">{ROLE_TEXT[r]}</span>
            </div>
          ))}
        </div>
      </Card>
      <Card title="Admins" flush>
        <table>
          <thead>
            <tr>
              <th>Email</th>
              <th>Role</th>
              <th className="hideSm">Added by</th>
              <th className="hideSm">Since</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {!members ? (
              <SkeletonRows cols={5} rows={3} />
            ) : (
              members.map((m) => (
                <tr key={m.uid}>
                  <td>
                    {m.email} {m.uid === user.uid && <span className="muted small">(you)</span>}
                  </td>
                  <td>
                    {m.uid === user.uid ? (
                      <span className="badge info">{m.role}</span>
                    ) : (
                      <select className="select" value={m.role} onChange={(e) => setPending({ email: m.email, role: e.target.value as Role })} aria-label={`Role for ${m.email}`}>
                        <option value="owner">owner</option>
                        <option value="support">support</option>
                        <option value="viewer">viewer</option>
                      </select>
                    )}
                  </td>
                  <td className="hideSm muted">{m.addedBy}</td>
                  <td className="hideSm muted">{date(m.at)}</td>
                  <td className="num">
                    {m.uid !== user.uid && (
                      <button className="btn btnSm" onClick={() => setPending({ email: m.email, role: null })}>
                        Remove
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>
      {pending && (
        <ReasonDialog
          title={pending.role ? `Make ${pending.email} ${pending.role}?` : `Remove ${pending.email} from the team?`}
          text={pending.role ? ROLE_TEXT[pending.role] : "They lose admin access at their next login (within the hour at most)."}
          confirmLabel={pending.role ? "Save role" : "Remove"}
          danger={!pending.role}
          onConfirm={async (reason) => {
            await adminApi("setRole", { email: pending.email, role: pending.role, reason });
            toast(pending.role ? "Role saved" : "Removed from the team");
            setEmail("");
            await load();
          }}
          onClose={() => setPending(null)}
        />
      )}
    </div>
  );
}
