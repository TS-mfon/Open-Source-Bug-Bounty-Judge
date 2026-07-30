"use client";

import {
  Activity,
  Braces,
  Blocks,
  BookOpen,
  CheckCircle2,
  CircleDollarSign,
  Code2,
  FileSearch,
  GitPullRequest,
  KeyRound,
  LayoutDashboard,
  LoaderCircle,
  Scale,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { FormEvent, useMemo, useState } from "react";

type View = "campaign" | "individual" | "tracker" | "api";
type CampaignAction = "create" | "contributions" | "review";
type ApiResult = {
  campaignId?: string;
  accepted?: number;
  reviewId?: string;
  transactionHash?: string;
  status?: string;
  review?: {
    result?: {
      candidates?: Array<{
        id: string;
        score: number;
        eligible: boolean;
        rank: number;
        recommended_usdc_micros: string;
      }>;
    };
  };
  error?: { message?: string; code?: string };
};

const defaultCandidates = JSON.stringify(
  [
    {
      id: "grantfox-pr-123",
      repository: "GrantChain/GrantFox",
      issueNumber: 101,
      pullRequestNumber: 123,
      headSha: "replace_with_40_character_commit_sha",
      contributor: "github-handle",
      contributionType: "code",
      stellarEvidenceUrls: [],
    },
  ],
  null,
  2,
);

function formatUsdc(value: string) {
  const micros = BigInt(value || "0");
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(micros) / 1_000_000);
}

export default function Home() {
  const [view, setView] = useState<View>("campaign");
  const [campaignAction, setCampaignAction] = useState<CampaignAction>("create");
  const [wallet, setWallet] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"success" | "error">("success");
  const [result, setResult] = useState<ApiResult | null>(null);
  const [reviewId, setReviewId] = useState("");
  const [transactionHash, setTransactionHash] = useState("");

  const viewTitle = useMemo(
    () =>
      ({
        campaign: ["Campaign Review", "Evaluate quality work and allocate a fixed USDC budget."],
        individual: ["Individual Review", "Use your wallet to request an evidence-backed PR review."],
        tracker: ["Review Tracker", "Read finalized judgments directly from GenLayer."],
        api: ["Integration API", "Connect an OSS platform through a stateless on-chain API."],
      })[view],
    [view],
  );

  async function connectWallet() {
    const ethereum = (
      window as typeof window & {
        ethereum?: {
          request: (input: { method: string; params?: unknown[] }) => Promise<string[]>;
        };
      }
    ).ethereum;
    if (!ethereum) {
      setMessageTone("error");
      setMessage("Install an EVM-compatible wallet to authenticate individual reviews.");
      return;
    }
    const accounts = await ethereum.request({ method: "eth_requestAccounts" });
    setWallet(accounts[0] ?? "");
  }

  async function submitCampaign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setMessageTone("success");
    setResult(null);
    const form = new FormData(event.currentTarget);
    try {
      const apiKey = String(form.get("apiKey"));
      const organizationId = String(form.get("organizationId"));
      const campaignId = String(form.get("campaignId"));
      const headers = {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
        "idempotency-key": crypto.randomUUID(),
      };

      let response: Response;
      if (campaignAction === "create") {
        response = await fetch("/api/v1/campaigns", {
          method: "POST",
          headers,
          body: JSON.stringify({
            id: campaignId,
            organizationId,
            externalId: String(form.get("externalId")),
            name: String(form.get("name")),
            budgetUsdcMicros: String(
              Math.round(Number(form.get("budget")) * 1_000_000),
            ),
            qualityThreshold: Number(form.get("threshold")),
            startsAt: new Date(String(form.get("startsAt"))).toISOString(),
            endsAt: new Date(String(form.get("endsAt"))).toISOString(),
            evidenceCutoff: new Date(String(form.get("cutoff"))).toISOString(),
            rubricVersion: "code-v1",
            rubric: {
              correctness: 25,
              tests: 20,
              maintainability: 15,
              scope_alignment: 15,
              impact: 15,
              complexity: 10,
            },
          }),
        });
      } else if (campaignAction === "contributions") {
        response = await fetch(
          `/api/v1/campaigns/${encodeURIComponent(campaignId)}/contributions`,
          {
            method: "POST",
            headers,
            body: JSON.stringify({
              organizationId,
              contributions: JSON.parse(String(form.get("candidates"))),
            }),
          },
        );
      } else {
        response = await fetch(
          `/api/v1/campaigns/${encodeURIComponent(campaignId)}/reviews`,
          {
            method: "POST",
            headers,
            body: JSON.stringify({
              organizationId,
              rubricVersion: "code-v1",
              appealContext: "",
            }),
          },
        );
      }

      const data = (await response.json()) as ApiResult;
      if (!response.ok) {
        throw new Error(data.error?.message ?? "Campaign operation failed");
      }
      setResult(data);
      setTransactionHash(data.transactionHash ?? "");
      if (data.reviewId) setReviewId(data.reviewId);
      setMessage(
        campaignAction === "create"
          ? "Campaign transaction submitted. Wait for finalization before registering candidates."
          : campaignAction === "contributions"
            ? "Candidate registration submitted. Wait for finalization before starting the review."
            : "Comparative review submitted. Use the review tracker to follow consensus.",
      );
    } catch (error) {
      setMessageTone("error");
      setMessage(error instanceof Error ? error.message : "Unable to create campaign.");
    } finally {
      setBusy(false);
    }
  }

  async function submitIndividual(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!wallet) {
      setMessage("Connect your wallet first.");
      return;
    }
    const ethereum = (
      window as typeof window & {
        ethereum?: {
          request: (input: { method: string; params?: unknown[] }) => Promise<string>;
        };
      }
    ).ethereum;
    if (!ethereum) return;
    const form = new FormData(event.currentTarget);
    const contribution = {
      id: `single-${String(form.get("repository")).replace("/", "-")}-${form.get("pr")}`,
      repository: String(form.get("repository")),
      issueNumber: Number(form.get("issue")),
      pullRequestNumber: Number(form.get("pr")),
      headSha: String(form.get("headSha")),
      contributor: String(form.get("contributor")),
      contributionType: String(form.get("type")),
      stellarEvidenceUrls: String(form.get("stellarUrl"))
        ? [String(form.get("stellarUrl"))]
        : [],
    };
    const expiresAt = Math.floor(Date.now() / 1000) + 10 * 60;
    const signMessage = [
      "Open Source Bug Bounty Judge",
      `Wallet: ${wallet.toLowerCase()}`,
      `Repository: ${contribution.repository.toLowerCase()}`,
      `Pull request: ${contribution.pullRequestNumber}`,
      `Head SHA: ${contribution.headSha.toLowerCase()}`,
      `Expires at: ${expiresAt}`,
    ].join("\n");
    setBusy(true);
    setMessage("");
    setMessageTone("success");
    try {
      const signature = await ethereum.request({
        method: "personal_sign",
        params: [signMessage, wallet],
      });
      const response = await fetch("/api/v1/reviews/single", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ wallet, signature, expiresAt, contribution }),
      });
      const data = (await response.json()) as ApiResult;
      if (!response.ok) throw new Error(data.error?.message ?? "Review submission failed");
      setResult(data);
      setReviewId(data.reviewId ?? "");
      setTransactionHash(data.transactionHash ?? "");
      setMessage("Review submitted to GenLayer. Track it after consensus finalizes.");
    } catch (error) {
      setMessageTone("error");
      setMessage(error instanceof Error ? error.message : "Unable to submit review.");
    } finally {
      setBusy(false);
    }
  }

  async function trackReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setMessageTone("success");
    const form = new FormData(event.currentTarget);
    const id = String(form.get("reviewId"));
    const hash = String(form.get("transactionHash"));
    try {
      const response = await fetch(
        `/api/v1/reviews/${encodeURIComponent(id)}${hash ? `?transactionHash=${hash}` : ""}`,
      );
      const data = (await response.json()) as ApiResult;
      if (!response.ok && response.status !== 202) {
        throw new Error(data.error?.message ?? "Unable to read review");
      }
      setResult(data);
      setMessage(`Current status: ${data.status ?? "pending"}`);
    } catch (error) {
      setMessageTone("error");
      setMessage(error instanceof Error ? error.message : "Unable to track review.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="app-shell">
      <aside className="side-nav">
        <div className="brand">
          <div className="brand-mark">OJ</div>
          <div className="brand-copy">
            <strong>OSS Judge</strong>
            <span>Contribution review protocol</span>
          </div>
        </div>
        <button
          className={`nav-button ${view === "campaign" ? "active" : ""}`}
          onClick={() => setView("campaign")}
        >
          <LayoutDashboard size={17} />
          <span className="nav-label">Campaign review</span>
        </button>
        <button
          className={`nav-button ${view === "individual" ? "active" : ""}`}
          onClick={() => setView("individual")}
        >
          <GitPullRequest size={17} />
          <span className="nav-label">Individual review</span>
        </button>
        <button
          className={`nav-button ${view === "tracker" ? "active" : ""}`}
          onClick={() => setView("tracker")}
        >
          <Activity size={17} />
          <span className="nav-label">Review tracker</span>
        </button>
        <button
          className={`nav-button ${view === "api" ? "active" : ""}`}
          onClick={() => setView("api")}
        >
          <Braces size={17} />
          <span className="nav-label">Integration API</span>
        </button>
        <div className="network-chip">
          <span />
          <span className="network-copy">GenLayer StudioNet</span>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <h1>{viewTitle[0]}</h1>
            <p>{viewTitle[1]}</p>
          </div>
          <button className="button secondary" onClick={connectWallet}>
            <Wallet size={15} />
            {wallet ? `${wallet.slice(0, 6)}...${wallet.slice(-4)}` : "Connect wallet"}
          </button>
        </header>

        <div className="content">
          <section className="stats" aria-label="Protocol summary">
            <div className="stat">
              <div className="stat-label">Canonical storage</div>
              <div className="stat-value">100%</div>
              <div className="stat-detail">On-chain state</div>
            </div>
            <div className="stat">
              <div className="stat-label">Evidence source</div>
              <div className="stat-value">GitHub</div>
              <div className="stat-detail">Repository fetched by validators</div>
            </div>
            <div className="stat">
              <div className="stat-label">Allocation rule</div>
              <div className="stat-value">Score²</div>
              <div className="stat-detail">Quality-weighted USDC</div>
            </div>
            <div className="stat">
              <div className="stat-label">Payout control</div>
              <div className="stat-value">Admin</div>
              <div className="stat-detail">Recommendation only</div>
            </div>
          </section>

          {message && (
            <div
              className={`notice ${messageTone}`}
              style={{ marginBottom: 16 }}
            >
              {message}
            </div>
          )}

          {view === "campaign" && (
            <div className="workspace">
              <section className="panel">
                <div className="panel-header">
                  <div>
                    <h2>Create campaign</h2>
                    <p>The API key and campaign record are verified on-chain.</p>
                  </div>
                  <Scale size={18} />
                </div>
                <form className="panel-body" onSubmit={submitCampaign}>
                  <div className="segmented" aria-label="Campaign operation">
                    {[
                      ["create", "Create campaign"],
                      ["contributions", "Add candidates"],
                      ["review", "Start review"],
                    ].map(([action, label]) => (
                      <button
                        key={action}
                        type="button"
                        className={campaignAction === action ? "active" : ""}
                        onClick={() => setCampaignAction(action as CampaignAction)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <div className="form-grid">
                    <div className="field full">
                      <label htmlFor="apiKey">Organization API key</label>
                      <input id="apiKey" name="apiKey" type="password" required placeholder="osj_live_..." />
                    </div>
                    <div className="field">
                      <label htmlFor="organizationId">Organization ID</label>
                      <input id="organizationId" name="organizationId" required placeholder="grantfox" />
                    </div>
                    <div className="field">
                      <label htmlFor="campaignId">Campaign ID</label>
                      <input id="campaignId" name="campaignId" required placeholder="grantfox-campaign-04" />
                    </div>
                    {campaignAction === "create" && (
                      <>
                        <div className="field">
                          <label htmlFor="externalId">External campaign ID</label>
                          <input id="externalId" name="externalId" required placeholder="campaign-04" />
                        </div>
                        <div className="field">
                          <label htmlFor="name">Campaign name</label>
                          <input id="name" name="name" required placeholder="Stellar Builders Sprint" />
                        </div>
                        <div className="field">
                          <label htmlFor="budget">Budget in USDC</label>
                          <input id="budget" name="budget" type="number" min="1" step="0.01" defaultValue="10000" required />
                        </div>
                        <div className="field">
                          <label htmlFor="threshold">Quality threshold</label>
                          <input id="threshold" name="threshold" type="number" min="50" max="95" defaultValue="70" required />
                        </div>
                        <div className="field">
                          <label htmlFor="startsAt">Starts</label>
                          <input id="startsAt" name="startsAt" type="datetime-local" required />
                        </div>
                        <div className="field">
                          <label htmlFor="endsAt">Ends</label>
                          <input id="endsAt" name="endsAt" type="datetime-local" required />
                        </div>
                        <div className="field full">
                          <label htmlFor="cutoff">Evidence cutoff</label>
                          <input id="cutoff" name="cutoff" type="datetime-local" required />
                        </div>
                      </>
                    )}
                    {campaignAction === "contributions" && (
                      <div className="field full">
                        <label htmlFor="candidates">Candidate contribution JSON</label>
                        <textarea id="candidates" name="candidates" defaultValue={defaultCandidates} required />
                        <div className="help">
                          Every candidate is bound to a public repository, pull request and immutable head SHA.
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="form-actions">
                    <button className="button orange" disabled={busy}>
                      {busy ? <LoaderCircle className="spin" size={15} /> : <Blocks size={15} />}
                      {campaignAction === "create"
                        ? "Create campaign"
                        : campaignAction === "contributions"
                          ? "Register candidates"
                          : "Start comparative review"}
                    </button>
                  </div>
                </form>
              </section>

              <aside className="panel">
                <div className="panel-header">
                  <div>
                    <h2>Review safeguards</h2>
                    <p>Applied before any scoring begins.</p>
                  </div>
                  <ShieldCheck size={18} />
                </div>
                <div className="panel-body">
                  <ul className="activity">
                    {[
                      ["Deterministic review key", "Repository, PR, commit SHA, campaign and rubric prevent duplicate reviews."],
                      ["Repository evidence", "Validators fetch issues, PR data, changed code, tests, reviews and configuration."],
                      ["Comparative scoring", "Quality work is ranked against the same campaign standard."],
                      ["Exact budget invariant", "Qualifying allocations sum to the submitted micro-USDC budget."],
                    ].map(([title, copy]) => (
                      <li key={title}>
                        <div className="activity-icon">
                          <CheckCircle2 size={15} />
                        </div>
                        <div>
                          <strong>{title}</strong>
                          <span>{copy}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </aside>
            </div>
          )}

          {view === "individual" && (
            <div className="workspace">
              <section className="panel">
                <div className="panel-header">
                  <div>
                    <h2>Review a public contribution</h2>
                    <p>Your wallet authenticates the request; the platform wallet pays and signs StudioNet.</p>
                  </div>
                  <FileSearch size={18} />
                </div>
                <form className="panel-body" onSubmit={submitIndividual}>
                  <div className="form-grid">
                    <div className="field">
                      <label htmlFor="repository">GitHub repository</label>
                      <input id="repository" name="repository" required placeholder="owner/repository" />
                    </div>
                    <div className="field">
                      <label htmlFor="contributor">Contributor handle</label>
                      <input id="contributor" name="contributor" required placeholder="github-handle" />
                    </div>
                    <div className="field">
                      <label htmlFor="issue">Issue number</label>
                      <input id="issue" name="issue" type="number" min="1" required />
                    </div>
                    <div className="field">
                      <label htmlFor="pr">Pull request number</label>
                      <input id="pr" name="pr" type="number" min="1" required />
                    </div>
                    <div className="field full">
                      <label htmlFor="headSha">Head commit SHA</label>
                      <input id="headSha" name="headSha" minLength={40} maxLength={40} required />
                    </div>
                    <div className="field">
                      <label htmlFor="type">Contribution type</label>
                      <select id="type" name="type" defaultValue="code">
                        <option value="code">Code</option>
                        <option value="documentation">Documentation</option>
                        <option value="design">Design</option>
                        <option value="infrastructure">Infrastructure</option>
                        <option value="security">Security</option>
                        <option value="mixed">Mixed</option>
                      </select>
                    </div>
                    <div className="field">
                      <label htmlFor="stellarUrl">Stellar evidence URL</label>
                      <input id="stellarUrl" name="stellarUrl" type="url" placeholder="https://..." />
                    </div>
                  </div>
                  <div className="form-actions">
                    <button type="button" className="button secondary" onClick={connectWallet}>
                      <Wallet size={15} />
                      {wallet ? "Wallet connected" : "Connect wallet"}
                    </button>
                    <button className="button orange" disabled={busy || !wallet}>
                      {busy ? <LoaderCircle size={15} /> : <GitPullRequest size={15} />}
                      Sign and review
                    </button>
                  </div>
                </form>
              </section>
              <aside className="panel">
                <div className="panel-header">
                  <div>
                    <h2>What validators inspect</h2>
                    <p>PR text is never treated as proof.</p>
                  </div>
                  <Code2 size={18} />
                </div>
                <div className="panel-body">
                  <div className="notice">
                    Changed source files, patches, tests, repository manifests, issue scope, commit history, reviews, CI/configuration and relevant Stellar evidence are fetched directly.
                  </div>
                </div>
              </aside>
            </div>
          )}

          {view === "tracker" && (
            <section className="panel">
              <div className="panel-header">
                <div>
                  <h2>Read review</h2>
                  <p>Pending transactions and finalized contract results share one workflow.</p>
                </div>
                <Activity size={18} />
              </div>
              <form className="panel-body" onSubmit={trackReview}>
                <div className="form-grid">
                  <div className="field full">
                    <label htmlFor="reviewId">Review ID</label>
                    <input id="reviewId" name="reviewId" defaultValue={reviewId} required />
                  </div>
                  <div className="field full">
                    <label htmlFor="transactionHash">Transaction hash while pending</label>
                    <input id="transactionHash" name="transactionHash" defaultValue={transactionHash} />
                  </div>
                </div>
                <div className="form-actions">
                  <button className="button" disabled={busy}>
                    <FileSearch size={15} />
                    Read on-chain state
                  </button>
                </div>
              </form>
              {result?.review?.result?.candidates && (
                <div className="panel-body" style={{ paddingTop: 0, overflowX: "auto" }}>
                  <table className="result-table">
                    <thead>
                      <tr>
                        <th>Rank</th>
                        <th>Contribution</th>
                        <th>Score</th>
                        <th>Eligibility</th>
                        <th>Recommended</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.review.result.candidates.map((candidate) => (
                        <tr key={candidate.id}>
                          <td>{candidate.rank || "—"}</td>
                          <td>{candidate.id}</td>
                          <td>{candidate.score}/100</td>
                          <td>
                            <span className={`badge ${candidate.eligible ? "" : "warn"}`}>
                              {candidate.eligible ? "Eligible" : "Not eligible"}
                            </span>
                          </td>
                          <td>{formatUsdc(candidate.recommended_usdc_micros)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          {view === "api" && (
            <div className="workspace">
              <section className="panel">
                <div className="panel-header">
                  <div>
                    <h2>Campaign integration</h2>
                    <p>Create, populate and review a campaign through versioned endpoints.</p>
                  </div>
                  <Braces size={18} />
                </div>
                <div className="panel-body">
                  <pre className="code">{`curl -X POST "$BASE/api/v1/campaigns" \\
  -H "Authorization: Bearer osj_live_..." \\
  -H "Idempotency-Key: campaign-04-create" \\
  -H "Content-Type: application/json" \\
  -d '{
    "id": "grantfox-campaign-04",
    "organizationId": "grantfox",
    "externalId": "campaign-04",
    "name": "Stellar Builders Sprint",
    "budgetUsdcMicros": "10000000000",
    "qualityThreshold": 70,
    "startsAt": "2027-07-01T00:00:00.000Z",
    "endsAt": "2027-07-20T00:00:00.000Z",
    "evidenceCutoff": "2027-07-21T00:00:00.000Z",
    "rubricVersion": "code-v1",
    "rubric": {
      "correctness": 25,
      "tests": 20,
      "maintainability": 15,
      "scope_alignment": 15,
      "impact": 15,
      "complexity": 10
    }
  }'`}</pre>
                </div>
              </section>
              <aside className="panel">
                <div className="panel-header">
                  <div>
                    <h2>Integration properties</h2>
                    <p>Designed for third-party OSS platforms.</p>
                  </div>
                  <KeyRound size={18} />
                </div>
                <div className="panel-body">
                  <ul className="activity">
                    {[
                      [Braces, "Stateless API", "No private review database or hidden scoring worker."],
                      [Blocks, "On-chain records", "Campaigns, candidates, API-key hashes and results live on GenLayer."],
                      [CircleDollarSign, "USDC recommendations", "Full budgets are allocated only among qualifying work."],
                      [BookOpen, "OpenAPI", "Machine-readable specification is available at /api/v1/openapi."],
                    ].map(([Icon, title, copy]) => {
                      const ItemIcon = Icon as typeof Braces;
                      return (
                        <li key={String(title)}>
                          <div className="activity-icon">
                            <ItemIcon size={15} />
                          </div>
                          <div>
                            <strong>{String(title)}</strong>
                            <span>{String(copy)}</span>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </aside>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
