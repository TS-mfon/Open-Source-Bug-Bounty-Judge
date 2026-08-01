"use client";

import { FileSearch, GitPullRequest, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { useWallet } from "@/components/wallet-provider";

type Review = {
  review_id: string;
  status: string;
  result?: { candidates?: Array<{ score: number; summary: string }> };
};

export default function IndividualPage() {
  const { wallet, connect, signReview } = useWallet();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!wallet) return;
    fetch(`/api/app/reviews?wallet=${wallet}`, { cache: "no-store" })
      .then((response) => response.json())
      .then((value) => setReviews(value.reviews ?? []))
      .catch(() => undefined);
  }, [wallet]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setNotice("");
    const form = new FormData(event.currentTarget);
    try {
      const activeWallet = wallet || (await connect());
      const intent = {
        repository: String(form.get("repository")),
        issueNumber: Number(form.get("issueNumber")),
        pullRequestNumber: Number(form.get("pullRequestNumber")),
        contributor: String(form.get("contributor")),
        contributionType: String(form.get("contributionType")),
        stellarEvidenceUrls: String(form.get("stellarEvidenceUrl"))
          ? [String(form.get("stellarEvidenceUrl"))]
          : [],
      };
      const resolveResponse = await fetch("/api/app/github/resolve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(intent),
      });
      const resolved = await resolveResponse.json();
      if (!resolveResponse.ok) throw new Error(resolved.error?.message ?? "Unable to resolve PR");
      const contribution = {
        id: `single-${intent.repository.replace("/", "-")}-${intent.pullRequestNumber}`,
        ...intent,
        contributor: intent.contributor || resolved.contributor,
        headSha: resolved.headSha,
      };
      const signed = await signReview(contribution);
      const response = await fetch("/api/v1/reviews/single", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ wallet: activeWallet, ...signed, contribution }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error?.message ?? "Review submission failed");
      setNotice(`Review submitted: ${result.reviewId}`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Review submission failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell title="Individual review" description="Request an evidence-backed judgment without finding a commit SHA.">
      <div className="two-column-layout">
        <section className="surface-section">
          <div className="section-title-row"><div><span>Public contribution</span><h2>Review a pull request</h2></div><GitPullRequest size={21} /></div>
          <form className="form-grid" onSubmit={submit}>
            <label>Repository<input name="repository" required placeholder="owner/repository" /></label>
            <label>Contributor<input name="contributor" placeholder="Resolved from GitHub when empty" /></label>
            <label>Issue number<input name="issueNumber" type="number" min="1" required /></label>
            <label>Pull request number<input name="pullRequestNumber" type="number" min="1" required /></label>
            <label>Contribution type<select name="contributionType" defaultValue="code"><option value="code">Code</option><option value="documentation">Documentation</option><option value="security">Security</option><option value="infrastructure">Infrastructure</option><option value="mixed">Mixed</option></select></label>
            <label>Stellar evidence URL<input name="stellarEvidenceUrl" type="url" placeholder="https://..." /></label>
            <div className="form-footer"><button className="primary-button" disabled={busy}>{busy ? <LoaderCircle className="spin" size={16} /> : <FileSearch size={16} />} Resolve and review</button></div>
          </form>
        </section>
        <aside className="evidence-panel">
          <span>Validator evidence</span>
          <h2>Repository first</h2>
          <p>The current PR head is resolved automatically, then validators fetch the issue, patch, changed source, tests, manifests, and CI.</p>
        </aside>
      </div>
      <section className="surface-section">
        <div className="section-title-row"><div><span>On-chain history</span><h2>Your reviews</h2></div><FileSearch size={20} /></div>
        <div className="data-list">
          {reviews.length ? reviews.map((review) => (
            <Link href={`/app/reviews/${review.review_id}`} key={review.review_id}>
              <div><strong>{review.review_id.slice(0, 28)}...</strong><span>{review.result?.candidates?.[0]?.summary ?? "Review recorded on GenLayer"}</span></div>
              <b>{review.result?.candidates?.[0]?.score ?? "—"}</b>
            </Link>
          )) : <div className="list-empty">No finalized individual reviews yet.</div>}
        </div>
      </section>
      {notice && <div className="toast-notice">{notice}</div>}
    </AppShell>
  );
}
