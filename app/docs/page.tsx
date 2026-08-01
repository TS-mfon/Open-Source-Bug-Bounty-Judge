import { ArrowRight, Braces, KeyRound, ShieldCheck } from "lucide-react";
import Link from "next/link";

const base = "https://open-source-bug-bounty-judge.vercel.app";

export default function DocsPage() {
  return (
    <div className="docs-layout">
      <aside className="docs-sidebar">
        <Link href="/" className="landing-brand"><b>OJ</b><span>OSS Judge</span></Link>
        <nav>
          <a href="#overview">Overview</a>
          <a href="#authentication">Authentication</a>
          <a href="#submit">Submit review</a>
          <a href="#results">Read results</a>
          <a href="#errors">Errors</a>
          <a href="#trust">Trust model</a>
        </nav>
        <Link href="/app" className="primary-button">Launch app <ArrowRight size={15} /></Link>
      </aside>
      <main className="docs-content">
        <div className="docs-hero" id="overview">
          <span>API v1 · OpenAPI 3.1</span>
          <h1>Review API</h1>
          <p>Submit a complete campaign candidate set for evidence-backed comparative review and retrieve the resulting on-chain allocation.</p>
          <div><a href="/api/v1/openapi" className="secondary-button"><Braces size={16} /> OpenAPI document</a></div>
        </div>

        <section id="authentication">
          <div className="doc-icon"><KeyRound size={19} /></div>
          <h2>Campaign authentication</h2>
          <p>Campaign keys are generated in the organization dashboard. Only the SHA-256 hash is stored on GenLayer. Send the plaintext key as a bearer token.</p>
          <pre className="code-block">{`Authorization: Bearer osj_live_...
Idempotency-Key: your-unique-request-id
Content-Type: application/json`}</pre>
        </section>

        <section id="submit">
          <div className="endpoint-title"><span className="method post">POST</span><code>/api/v1/reviews</code></div>
          <p>Each request supplies the complete candidate set to compare under the authenticated campaign’s budget, threshold, and rubric.</p>
          <pre className="code-block">{`curl -X POST ${base}/api/v1/reviews \\
  -H "Authorization: Bearer $OSS_JUDGE_KEY" \\
  -H "Idempotency-Key: routedock-wave-04" \\
  -H "Content-Type: application/json" \\
  -d '{
    "candidates": [{
      "id": "routedock-pr-197",
      "repository": "winsznx/routedock",
      "issueNumber": 135,
      "pullRequestNumber": 197,
      "headSha": "46b2ac67e00c7f5fd59d7afdc77d57a52fb324ac",
      "contributor": "winsznx",
      "contributionType": "code",
      "stellarEvidenceUrls": []
    }]
  }'`}</pre>
          <h3>Accepted response</h3>
          <pre className="code-block">{`{
  "reviewId": "review_...",
  "campaignId": "stellar-builders-2026",
  "status": "submitted",
  "transactionHash": "0x...",
  "statusUrl": "/api/v1/reviews/review_...?... "
}`}</pre>
        </section>

        <section id="results">
          <div className="endpoint-title"><span className="method get">GET</span><code>/api/v1/reviews/:reviewId</code></div>
          <p>Returns the finalized scorecards, ranking, allocation, explanation, and exact evidence citations. Use the transaction hash query parameter while consensus is pending.</p>
          <div className="endpoint-title"><span className="method get">GET</span><code>/api/v1/reviews?cursor=0&amp;limit=20</code></div>
          <p>Lists reviews indexed to the campaign represented by the bearer key.</p>
          <div className="endpoint-title"><span className="method get">GET</span><code>/api/v1/campaign</code></div>
          <p>Returns campaign configuration and campaign-key usage counters.</p>
        </section>

        <section id="errors">
          <h2>Error model</h2>
          <div className="error-table">
            <div><code>401</code><span>Missing, revoked, or invalid campaign key.</span></div>
            <div><code>409</code><span>Duplicate candidate revision set or stale head SHA.</span></div>
            <div><code>422</code><span>Invalid candidate batch or unavailable required evidence.</span></div>
            <div><code>503</code><span>Transient GitHub, StudioNet, or source-rate-limit failure.</span></div>
          </div>
        </section>

        <section id="trust" className="trust-doc">
          <div className="doc-icon"><ShieldCheck size={19} /></div>
          <h2>Trust boundary</h2>
          <p>API keys authorize review requests but never sign GenLayer transactions. The platform wallet is the only relayer. Validators independently fetch evidence and decide the score; the relayer cannot choose the verdict.</p>
        </section>
      </main>
    </div>
  );
}
