"use client";

import { ArrowRight, Building2, LoaderCircle, Plus, UserRound, Wallet } from "lucide-react";
import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { useWallet } from "@/components/wallet-provider";

type ProfileResponse = {
  profile?: { default_workspace: "individual" | "organization" };
  nonce: number;
  organizations: Array<{ id: string; name: string }>;
};

export default function WorkspacePage() {
  const { wallet, connect, signAction } = useWallet();
  const [data, setData] = useState<ProfileResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!wallet) return;
    fetch(`/api/app/profile?wallet=${wallet}`, { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((value) => { if (value) setData(value as ProfileResponse); })
      .catch(() => undefined);
  }, [wallet]);

  async function register(defaultWorkspace: "individual" | "organization") {
    setBusy(true);
    setNotice("");
    try {
      if (!wallet) await connect();
      const payload = { defaultWorkspace };
      const envelope = await signAction("profile.register", payload, data?.nonce ?? 0);
      const response = await fetch("/api/app/profile", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(envelope),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error?.message ?? "Unable to register profile");
      setNotice("Profile registration submitted to GenLayer. Refresh after finalization.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Profile registration failed.");
    } finally {
      setBusy(false);
    }
  }

  async function createOrganization(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!data) return;
    setBusy(true);
    setNotice("");
    const form = new FormData(event.currentTarget);
    try {
      const payload = {
        id: String(form.get("id")).toLowerCase().replace(/[^a-z0-9-]/g, "-"),
        name: String(form.get("name")),
      };
      const envelope = await signAction("organization.create", payload, data.nonce);
      const response = await fetch("/api/app/organizations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(envelope),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error?.message ?? "Unable to create organization");
      setNotice("Organization creation submitted. It will appear after GenLayer finalizes.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Organization creation failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell title="Workspaces" description="Choose a personal or organization workspace.">
      {!wallet ? (
        <section className="empty-state">
          <Wallet size={28} />
          <h2>Connect your wallet</h2>
          <p>Your wallet authenticates dashboard actions. The platform wallet relays them to GenLayer.</p>
          <button className="primary-button" onClick={() => void connect()}>Connect wallet</button>
        </section>
      ) : !data?.profile ? (
        <section className="onboarding">
          <div className="section-heading">
            <span>On-chain profile</span>
            <h2>How will you use OSS Judge?</h2>
            <p>This becomes your default workspace and can be changed later.</p>
          </div>
          <div className="role-grid">
            <button onClick={() => void register("individual")} disabled={busy}>
              <UserRound size={25} />
              <strong>Individual</strong>
              <span>Review a public pull request with wallet authentication.</span>
              <ArrowRight size={18} />
            </button>
            <button onClick={() => void register("organization")} disabled={busy}>
              <Building2 size={25} />
              <strong>Organization</strong>
              <span>Create campaigns, manage members, and issue review API keys.</span>
              <ArrowRight size={18} />
            </button>
          </div>
        </section>
      ) : (
        <>
          <div className="workspace-grid">
            <Link href="/app/individual" className="workspace-tile">
              <UserRound size={22} />
              <div><strong>Personal reviews</strong><span>Request and revisit individual judgments.</span></div>
              <ArrowRight size={18} />
            </Link>
            {data.organizations.map((organization) => (
              <Link key={organization.id} href={`/app/organizations/${organization.id}`} className="workspace-tile">
                <Building2 size={22} />
                <div><strong>{organization.name}</strong><span>{organization.id}</span></div>
                <ArrowRight size={18} />
              </Link>
            ))}
          </div>
          <section className="surface-section compact-section">
            <div className="section-title-row">
              <div><span>Organization registry</span><h2>Create an organization</h2></div>
              <Plus size={20} />
            </div>
            <form className="inline-form" onSubmit={createOrganization}>
              <label>Organization name<input name="name" required placeholder="RouteDock" /></label>
              <label>Organization ID<input name="id" required placeholder="route-dock" /></label>
              <button className="primary-button" disabled={busy}>
                {busy ? <LoaderCircle className="spin" size={16} /> : <Plus size={16} />} Create
              </button>
            </form>
          </section>
        </>
      )}
      {notice && <div className="toast-notice">{notice}</div>}
    </AppShell>
  );
}
