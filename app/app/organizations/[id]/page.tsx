"use client";

import {
  ArrowRight,
  Ban,
  Clipboard,
  FileClock,
  KeyRound,
  Plus,
  RotateCw,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { useAutoRefresh } from "@/components/use-auto-refresh";
import {
  generateCampaignKey,
  hashCampaignKey,
  useWallet,
} from "@/components/wallet-provider";
import { apiErrorMessage } from "@/lib/client-errors";

type Campaign = { id: string; name: string; budget_usdc_micros: string; quality_threshold: number; status: string };
type Review = { review_id: string; campaign_id: string; status: string; result?: { candidates?: Array<{ score: number }> } };

export default function OrganizationPage() {
  const { id } = useParams<{ id: string }>();
  const { wallet, signAction } = useWallet();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [nonce, setNonce] = useState(0);
  const [busyCampaign, setBusyCampaign] = useState("");
  const [revealedKey, setRevealedKey] = useState("");
  const [notice, setNotice] = useState("");

  const loadOrganization = useCallback(async () => {
    if (!wallet || !id) return;
    const [campaignData, reviewData] = await Promise.all([
      fetch(`/api/app/organizations/${id}/campaigns?wallet=${wallet}`, { cache: "no-store" }).then((r) => r.json()),
      fetch(`/api/app/reviews?organizationId=${id}&wallet=${wallet}`, { cache: "no-store" }).then((r) => r.json()),
    ]);
    setCampaigns(campaignData.campaigns ?? []);
    setNonce(campaignData.nonce ?? 0);
    setReviews(reviewData.reviews ?? []);
  }, [wallet, id]);
  const refreshOrganization = useAutoRefresh(
    loadOrganization,
    Boolean(wallet && id),
  );

  const budget = campaigns.reduce((sum, item) => sum + Number(item.budget_usdc_micros), 0) / 1_000_000;

  async function mutateKey(campaignId: string, mode: "rotate" | "revoke") {
    setBusyCampaign(campaignId);
    setNotice("");
    setRevealedKey("");
    try {
      const secret = mode === "rotate" ? generateCampaignKey() : "";
      const payload = {
        campaignId,
        organizationId: id,
        ...(mode === "rotate" ? { keyHash: await hashCampaignKey(secret) } : {}),
      };
      const envelope = await signAction(`campaign.key.${mode}`, payload, nonce);
      const response = await fetch(
        `/api/app/organizations/${id}/campaigns/${campaignId}/key`,
        {
          method: mode === "rotate" ? "PATCH" : "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(envelope),
        },
      );
      const result = await response.json();
      if (!response.ok) {
        throw new Error(apiErrorMessage(result, "API key update failed"));
      }
      if (secret) setRevealedKey(secret);
      setNotice(
        mode === "rotate"
          ? "Key rotation submitted. Store the new key now. Auto-refreshing in 30 seconds."
          : "Key revocation submitted. Auto-refreshing in 30 seconds.",
      );
      window.setTimeout(() => void refreshOrganization(), 30_000);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "API key update failed.");
    } finally {
      setBusyCampaign("");
    }
  }

  return (
    <AppShell organizationId={id} title={id} description="Campaign operations and on-chain review activity.">
      <section className="metric-grid">
        <article><span>Campaigns</span><strong>{campaigns.length}</strong><small>On-chain records</small></article>
        <article><span>Reviews</span><strong>{reviews.length}</strong><small>Comparative judgments</small></article>
        <article><span>Configured budget</span><strong>${budget.toLocaleString()}</strong><small>Recommendation pool</small></article>
        <article><span>Signing model</span><strong>Relayed</strong><small>Platform wallet</small></article>
      </section>
      <div className="section-actions">
        <Link href={`/app/organizations/${id}/campaigns/new`} className="primary-button"><Plus size={16} /> New campaign</Link>
        <Link href={`/app/organizations/${id}/members`} className="secondary-button"><Users size={16} /> Manage members</Link>
      </div>
      <section className="surface-section">
        <div className="section-title-row"><div><span>Campaign registry</span><h2>Campaigns</h2></div><KeyRound size={20} /></div>
        <div className="data-list">
          {campaigns.length ? campaigns.map((campaign) => (
            <article key={campaign.id}>
              <div><strong>{campaign.name}</strong><span>{campaign.id} · threshold {campaign.quality_threshold}</span></div>
              <b>${(Number(campaign.budget_usdc_micros) / 1_000_000).toLocaleString()}</b>
              <div className="row-actions">
                <button
                  className="icon-button"
                  aria-label={`Rotate API key for ${campaign.name}`}
                  title="Rotate API key"
                  disabled={busyCampaign === campaign.id}
                  onClick={() => void mutateKey(campaign.id, "rotate")}
                >
                  <RotateCw size={15} />
                </button>
                <button
                  className="icon-button danger-button"
                  aria-label={`Revoke API key for ${campaign.name}`}
                  title="Revoke API key"
                  disabled={busyCampaign === campaign.id}
                  onClick={() => void mutateKey(campaign.id, "revoke")}
                >
                  <Ban size={15} />
                </button>
              </div>
            </article>
          )) : <div className="list-empty">Create the first campaign to issue a review API key.</div>}
        </div>
        {revealedKey && (
          <div className="secret-field">
            <code>{revealedKey}</code>
            <button
              className="icon-button"
              aria-label="Copy rotated API key"
              onClick={() => void navigator.clipboard.writeText(revealedKey)}
            >
              <Clipboard size={16} />
            </button>
          </div>
        )}
      </section>
      <section className="surface-section">
        <div className="section-title-row"><div><span>Recent consensus</span><h2>Review history</h2></div><FileClock size={20} /></div>
        <div className="data-list">
          {reviews.slice(0, 5).map((review) => (
            <Link key={review.review_id} href={`/app/reviews/${review.review_id}`}>
              <div><strong>{review.campaign_id}</strong><span>{review.review_id.slice(0, 30)}...</span></div>
              <span className="row-score">{review.result?.candidates?.[0]?.score ?? "—"} <ArrowRight size={15} /></span>
            </Link>
          ))}
          {!reviews.length && <div className="list-empty">No finalized reviews yet.</div>}
        </div>
      </section>
      {notice && <div className="toast-notice">{notice}</div>}
    </AppShell>
  );
}
