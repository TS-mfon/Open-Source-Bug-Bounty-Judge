"use client";

import { ExternalLink, FileCode2, Scale, ShieldCheck } from "lucide-react";
import { useParams } from "next/navigation";
import { useCallback, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { useAutoRefresh } from "@/components/use-auto-refresh";

type Candidate = {
  id: string;
  score: number;
  eligible: boolean;
  rank: number;
  recommended_usdc_micros: string;
  summary: string;
  strengths: string[];
  deficiencies: string[];
  flags: string[];
  citations: string[];
  dimensions: Record<string, number>;
};

type Review = {
  review_id: string;
  campaign_id: string;
  organization_id: string;
  status: string;
  budget_usdc_micros: string;
  result: { explanation: string; candidates: Candidate[] };
};

export default function ReviewDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [review, setReview] = useState<Review | null>(null);

  const loadReview = useCallback(async () => {
    if (!id) return;
    const response = await fetch(`/api/v1/reviews/${id}`, {
      cache: "no-store",
    });
    if (!response.ok && response.status !== 202) return;
    const value = await response.json();
    setReview(value.review ?? null);
  }, [id]);
  useAutoRefresh(loadReview, Boolean(id));

  return (
    <AppShell title="Review detail" description={id}>
      {!review ? <section className="empty-state"><FileCode2 size={28} /><h2>Review pending</h2><p>The result will appear after GenLayer consensus finalizes. This page refreshes every 30 seconds.</p></section> : (
        <>
          <section className="metric-grid">
            <article><span>Status</span><strong>{review.status}</strong><small>Consensus result</small></article>
            <article><span>Campaign</span><strong>{review.campaign_id}</strong><small>{review.organization_id}</small></article>
            <article><span>Candidates</span><strong>{review.result.candidates.length}</strong><small>Comparative set</small></article>
            <article><span>Budget</span><strong>${(Number(review.budget_usdc_micros) / 1_000_000).toLocaleString()}</strong><small>USDC recommendation</small></article>
          </section>
          <section className="surface-section">
            <div className="section-title-row"><div><span>Consensus explanation</span><h2>Campaign assessment</h2></div><Scale size={20} /></div>
            <p className="review-explanation">{review.result.explanation}</p>
          </section>
          {review.result.candidates.map((candidate) => (
            <section className="candidate-detail" key={candidate.id}>
              <header>
                <div><span>Rank {candidate.rank || "—"}</span><h2>{candidate.id}</h2><p>{candidate.summary}</p></div>
                <div className="score-ring"><strong>{candidate.score}</strong><span>/100</span></div>
              </header>
              <div className="dimension-grid">
                {Object.entries(candidate.dimensions).map(([name, score]) => (
                  <div key={name}><span>{name.replace("_", " ")}</span><b>{score}</b><i><em style={{ width: `${score}%` }} /></i></div>
                ))}
              </div>
              <div className="finding-grid">
                <div><h3>Strengths</h3><ul>{candidate.strengths.map((item) => <li key={item}>{item}</li>)}</ul></div>
                <div><h3>Deficiencies</h3><ul>{candidate.deficiencies.length ? candidate.deficiencies.map((item) => <li key={item}>{item}</li>) : <li>None recorded</li>}</ul></div>
              </div>
              <div className="citation-list">
                <h3><ShieldCheck size={16} /> Fetched evidence</h3>
                {candidate.citations.map((citation) => <a key={citation} href={citation} target="_blank" rel="noreferrer">{citation}<ExternalLink size={14} /></a>)}
              </div>
            </section>
          ))}
        </>
      )}
    </AppShell>
  );
}
