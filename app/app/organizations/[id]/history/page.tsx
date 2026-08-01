"use client";

import { ArrowRight, FileClock } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { useWallet } from "@/components/wallet-provider";

type Review = {
  review_id: string;
  campaign_id: string;
  status: string;
  result?: { candidates?: Array<{ score: number; eligible: boolean; recommended_usdc_micros: string }> };
};

export default function HistoryPage() {
  const { id } = useParams<{ id: string }>();
  const { wallet } = useWallet();
  const [reviews, setReviews] = useState<Review[]>([]);

  useEffect(() => {
    if (!wallet) return;
    fetch(`/api/app/reviews?organizationId=${id}&wallet=${wallet}`, { cache: "no-store" })
      .then((response) => response.json())
      .then((value) => setReviews(value.reviews ?? []))
      .catch(() => undefined);
  }, [wallet, id]);

  return (
    <AppShell organizationId={id} title="Review history" description="Finalized campaign judgments read directly from GenLayer.">
      <section className="surface-section">
        <div className="section-title-row"><div><span>On-chain index</span><h2>Organization reviews</h2></div><FileClock size={20} /></div>
        <div className="history-table">
          <div className="history-head"><span>Campaign</span><span>Status</span><span>Top score</span><span>Allocation</span><span /></div>
          {reviews.map((review) => {
            const candidate = review.result?.candidates?.[0];
            return (
              <Link key={review.review_id} href={`/app/reviews/${review.review_id}`}>
                <span><b>{review.campaign_id}</b><small>{review.review_id.slice(0, 24)}...</small></span>
                <span className="status-pill">{review.status}</span>
                <span>{candidate?.score ?? "—"}</span>
                <span>${((Number(candidate?.recommended_usdc_micros ?? 0)) / 1_000_000).toLocaleString()}</span>
                <ArrowRight size={16} />
              </Link>
            );
          })}
          {!reviews.length && <div className="list-empty">No finalized reviews are indexed for this organization.</div>}
        </div>
      </section>
    </AppShell>
  );
}
