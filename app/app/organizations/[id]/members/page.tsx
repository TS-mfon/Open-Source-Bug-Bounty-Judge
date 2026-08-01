"use client";

import { LoaderCircle, Shield, Trash2, UserPlus } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { useWallet } from "@/components/wallet-provider";

type Member = { wallet: string; role: string };

export default function MembersPage() {
  const { id } = useParams<{ id: string }>();
  const { wallet, signAction } = useWallet();
  const [members, setMembers] = useState<Member[]>([]);
  const [nonce, setNonce] = useState(0);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!wallet) return;
    fetch(`/api/app/organizations/${id}/members?wallet=${wallet}`, { cache: "no-store" })
      .then((response) => response.json())
      .then((value) => {
        setMembers(value.members ?? []);
        setNonce(value.nonce ?? 0);
      })
      .catch(() => undefined);
  }, [wallet, id]);

  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      const payload = {
        organizationId: id,
        memberWallet: String(form.get("memberWallet")),
        role: String(form.get("role")),
      };
      const envelope = await signAction("organization.member.add", payload, nonce);
      const response = await fetch(`/api/app/organizations/${id}/members`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(envelope),
      });
      const value = await response.json();
      if (!response.ok) throw new Error(value.error?.message ?? "Member update failed");
      setNotice("Membership transaction submitted to GenLayer.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Member update failed.");
    } finally {
      setBusy(false);
    }
  }

  async function update(member: Member, mode: "role" | "remove", role = member.role) {
    setBusy(true);
    setNotice("");
    try {
      const payload = {
        organizationId: id,
        memberWallet: member.wallet,
        role,
      };
      const envelope = await signAction(
        mode === "role" ? "organization.member.role" : "organization.member.remove",
        payload,
        nonce,
      );
      const response = await fetch(`/api/app/organizations/${id}/members`, {
        method: mode === "role" ? "PATCH" : "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(envelope),
      });
      const value = await response.json();
      if (!response.ok) throw new Error(value.error?.message ?? "Member update failed");
      setNotice(
        mode === "role"
          ? "Role update submitted to GenLayer."
          : "Member removal submitted to GenLayer.",
      );
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Member update failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell organizationId={id} title="Members" description="Manage wallets authorized for this organization.">
      <section className="surface-section">
        <div className="section-title-row"><div><span>Organization registry</span><h2>Authorized wallets</h2></div><Shield size={20} /></div>
        <div className="member-table">
          {members.map((member) => (
            <div key={member.wallet}>
              <code>{member.wallet}</code>
              {member.role === "creator" ? (
                <span className="role-badge creator">creator</span>
              ) : (
                <div className="member-actions">
                  <select
                    aria-label={`Role for ${member.wallet}`}
                    value={member.role}
                    disabled={busy}
                    onChange={(event) => void update(member, "role", event.target.value)}
                  >
                    <option value="member">Member</option>
                    <option value="admin">Admin</option>
                  </select>
                  <button
                    className="icon-button danger-button"
                    aria-label={`Remove ${member.wallet}`}
                    title="Remove wallet"
                    disabled={busy}
                    onClick={() => void update(member, "remove")}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              )}
            </div>
          ))}
          {!members.length && <div className="list-empty">Connect an organization wallet to read membership.</div>}
        </div>
      </section>
      <section className="surface-section compact-section">
        <div className="section-title-row"><div><span>Admin action</span><h2>Add a wallet</h2></div><UserPlus size={20} /></div>
        <form className="inline-form" onSubmit={add}>
          <label>Wallet address<input name="memberWallet" required placeholder="0x..." /></label>
          <label>Role<select name="role"><option value="member">Member</option><option value="admin">Admin</option></select></label>
          <button className="primary-button" disabled={busy}>{busy ? <LoaderCircle className="spin" size={16} /> : <UserPlus size={16} />} Add wallet</button>
        </form>
      </section>
      {notice && <div className="toast-notice">{notice}</div>}
    </AppShell>
  );
}
