import { ArrowRight, Braces, KeyRound, RefreshCw, ShieldCheck } from "lucide-react";
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
          <a href="#quickstart">Quickstart</a>
          <a href="#submit">Submit review</a>
          <a href="#lifecycle">Lifecycle</a>
          <a href="#read">Read data</a>
          <a href="#integration">Integration guide</a>
          <a href="#appeals">Appeals</a>
          <a href="#webhooks">Webhooks</a>
          <a href="#errors">Errors</a>
          <a href="#trust">Trust model</a>
        </nav>
        <Link href="/app" className="primary-button">Launch app <ArrowRight size={15} /></Link>
      </aside>
      <main className="docs-content">
        <div className="docs-hero" id="overview">
          <span>API v1 · OpenAPI 3.1 · StudioNet</span>
          <h1>Review API</h1>
          <p>
            Submit one pull request per GenLayer review, poll consensus, read
            evidence-backed scorecards, and retrieve capped on-chain reward
            recommendations.
          </p>
          <div><a href="/api/v1/openapi" className="secondary-button"><Braces size={16} /> OpenAPI document</a></div>
        </div>

        <section>
          <h2>Integration lifecycle</h2>
          <ol className="docs-steps">
            <li><b>1</b><span>Create a campaign in the wallet-authenticated dashboard and store the one-time API key.</span></li>
            <li><b>2</b><span>Submit one pull request with one idempotency key. The API resolves the current PR head SHA automatically.</span></li>
            <li><b>3</b><span>Receive the finalized result in the same response when consensus completes within 240 seconds; otherwise poll the returned status URL every 30 seconds.</span></li>
            <li><b>4</b><span>Use scorecards, citations, ranking, and the $20-$60 recommendation in your payout approval workflow.</span></li>
          </ol>
          <p>
            Campaign creation and API-key rotation are dashboard operations.
            Third-party integrations use the campaign key only for reviews,
            results, appeals, campaign inspection, and webhooks.
          </p>
        </section>

        <section id="authentication">
          <div className="doc-icon"><KeyRound size={19} /></div>
          <h2>Campaign authentication</h2>
          <p>
            Every campaign receives a unique <code>osj_live_...</code> key. Only
            its SHA-256 hash and scopes are stored on-chain. The plaintext is
            shown once and must be kept by the integrating organization.
          </p>
          <pre className="code-block">{`Authorization: Bearer osj_live_...
Idempotency-Key: your-unique-logical-request-id
Content-Type: application/json`}</pre>
          <p>
            Review and appeal writes wait up to 240 seconds for consensus by
            default. Send <code>Prefer: respond-async</code> for an immediate
            <code>202</code>, or <code>Prefer: wait=120</code> to set a shorter
            wait window.
          </p>
          <h3>Idempotency rules</h3>
          <ul className="docs-list">
            <li>Required on every review or appeal write.</li>
            <li>Length: 8 to 128 characters.</li>
            <li>Reuse the same value only when retrying the same logical request after transport uncertainty.</li>
            <li>Use a new value when any candidate revision or appeal context changes.</li>
          </ul>
        </section>

        <section id="quickstart">
          <div className="doc-icon"><Braces size={19} /></div>
          <h2>Quickstart</h2>
          <p>
            The smallest integration sends a GitHub pull request URL and its
            linked issue number. You do not need to find or submit a commit SHA.
            The API resolves the repository, pull request number, author, and
            immutable current revision before submitting the GenLayer request.
          </p>
          <pre className="code-block">{`export async function reviewPullRequest({ apiKey, pullRequestUrl, issueNumber }) {
  const response = await fetch(
    "${base}/api/v1/reviews",
    {
      method: "POST",
      headers: {
        Authorization: \`Bearer \${apiKey}\`,
        "Content-Type": "application/json",
        "Idempotency-Key": \`campaign-\${issueNumber}-review-01\`,
        Prefer: "respond-async"
      },
      body: JSON.stringify({
        candidates: [{
          pullRequestUrl,
          issueNumber,
          contributionType: "code"
        }]
      })
    }
  );

  const body = await response.json();
  if (!response.ok) throw new Error(body.error?.message ?? "Review failed");
  return body;
}`}</pre>
          <p>
            Reuse the same idempotency key only when retrying the exact same
            logical request after transport uncertainty. Use a new key for a
            different PR, issue, or revision.
          </p>
        </section>

        <section id="submit">
          <div className="endpoint-title"><span className="method post">POST</span><code>/api/v1/reviews</code></div>
          <p>
            Submits exactly one immutable pull-request revision under the campaign
            budget, threshold, and rubric represented by the bearer key. The API
            resolves the repository, PR number, contributor, and current head SHA
            from GitHub before the platform relayer submits the GenLayer transaction.
          </p>
          <pre className="code-block">{`curl -X POST ${base}/api/v1/reviews \\
  -H "Authorization: Bearer $OSS_JUDGE_KEY" \\
  -H "Idempotency-Key: routedock-wave-04" \\
  -H "Content-Type: application/json" \\
  -d '{
    "candidates": [{
      "pullRequestUrl": "https://github.com/winsznx/routedock/pull/197",
      "issueNumber": 135,
      "contributionType": "code",
      "stellarEvidenceUrls": []
    }],
    "appealContext": ""
  }'`}</pre>

          <h3>Candidate fields</h3>
          <div className="field-table">
            <div><code>pullRequestUrl</code><span>Recommended. Full public GitHub pull request URL. Use this instead of supplying repository and PR number separately.</span></div>
            <div><code>id</code><span>Optional. Stable 3-96 character integration identifier. Generated from the repository and PR when omitted.</span></div>
            <div><code>repository</code><span>Alternative to <code>pullRequestUrl</code>. Public GitHub repository in <code>owner/repository</code> form.</span></div>
            <div><code>issueNumber</code><span>Required positive integer. Defines the acceptance scope.</span></div>
            <div><code>pullRequestNumber</code><span>Required only when using <code>repository</code> instead of <code>pullRequestUrl</code>.</span></div>
            <div><code>headSha</code><span>Optional stale-revision guard. The API resolves the current 40-character commit SHA automatically and rejects a supplied stale value.</span></div>
            <div><code>contributor</code><span>Optional. Resolved from the pull request author when omitted.</span></div>
            <div><code>contributionType</code><span><code>code</code>, <code>documentation</code>, <code>design</code>, <code>infrastructure</code>, <code>security</code>, or <code>mixed</code>.</span></div>
            <div><code>stellarEvidenceUrls</code><span>Optional. Up to six HTTPS supplementary evidence URLs. Repository evidence is still fetched independently.</span></div>
          </div>

          <h3>Reward policy</h3>
          <ul className="docs-list">
            <li>Campaign budgets must be at least 5,000 USDC.</li>
            <li>Every positive issue-fix recommendation is at least 20 USDC and at most 60 USDC.</li>
            <li>Validator-agreed scores map to exact 20, 40, or 60 USDC quality tiers relative to the campaign threshold.</li>
            <li>Validators must agree on the tier; a score tolerance cannot cross a threshold or reward-tier boundary.</li>
            <li>Recommendations consume the campaign&apos;s remaining budget in rank order across reviews. The on-chain campaign record exposes cumulative <code>spent_usdc_micros</code>; a remainder below 20 USDC stays unallocated.</li>
          </ul>

          <h3>Finalized response · 200</h3>
          <pre className="code-block">{`{
  "reviewId": "review_3f068f...",
  "campaignId": "routedock-issue-135",
  "status": "finalized",
  "transactionHash": "0x650c...",
  "statusUrl": "/api/v1/reviews/review_3f068f...?transactionHash=0x650c...",
  "review": {
    "result": {
      "candidates": [{
        "score": 84,
        "reward_tier_usdc_micros": "40000000",
        "recommended_usdc_micros": "40000000"
      }]
    }
  }
}`}</pre>

          <h3>Deferred response · 202</h3>
          <pre className="code-block">{`{
  "reviewId": "review_3f068f...",
  "campaignId": "routedock-issue-135",
  "status": "submitted",
  "transactionHash": "0x650c...",
  "statusUrl": "/api/v1/reviews/review_3f068f...?transactionHash=0x650c..."
}`}</pre>
        </section>

        <section id="lifecycle">
          <div className="doc-icon"><RefreshCw size={19} /></div>
          <h2>Consensus lifecycle and polling</h2>
          <p>
            The submission endpoint actively polls GenLayer and normally returns
            the finalized scorecard directly. A <code>202</code> means consensus
            outlived the selected wait window, not that processing stopped. The
            transaction continues independently on-chain. Poll
            <code>statusUrl</code> every 30 seconds; the submission endpoint uses
            the same quota-conscious interval. Add
            <code>&amp;wait=30</code> for robust long polling. Do not submit the
            review again while that transaction is pending.
          </p>
          <pre className="code-block">{`curl "${base}/api/v1/reviews/$REVIEW_ID?transactionHash=$TX_HASH&wait=30"`}</pre>
          <div className="field-table">
            <div><code>202 submitted</code><span>Consensus is still pending. Continue polling.</span></div>
            <div><code>200 finalized</code><span>The canonical on-chain review is available.</span></div>
            <div><code>200 failed</code><span>Inspect <code>transaction.error</code>, correct retryable evidence/source failures, then use a new idempotency key.</span></div>
          </div>
          <h3>What happens during a review</h3>
          <ol className="docs-steps">
            <li><b>1</b><span>The API authenticates the campaign key and validates the one-PR request.</span></li>
            <li><b>2</b><span>GitHub is queried for the current PR head, author, repository, issue, and pull request metadata.</span></li>
            <li><b>3</b><span>The platform wallet submits the resolved immutable candidate to GenLayer.</span></li>
            <li><b>4</b><span>Validators independently fetch the repository, issue, PR page, patch, changed source, tests, manifests, CI, and allowed supplementary evidence.</span></li>
            <li><b>5</b><span>Consensus compares eligibility, threshold status, reward tier, and bounded score variance before storing the result on-chain.</span></li>
          </ol>
          <p>
            The platform does not make payouts. The recommendation is an
            auditable input for your organization&apos;s own reward workflow.
          </p>
        </section>

        <section id="read">
          <div className="endpoint-title"><span className="method get">GET</span><code>/api/v1/reviews/:reviewId</code></div>
          <p>
            Public read endpoint for status, candidate scorecards, strengths,
            deficiencies, flags, dimensions, confidence, ranking, exact fetched
            citations, reward tier, budget-limit flag, and recommended micro-USDC amount.
          </p>
          <div className="endpoint-title"><span className="method get">GET</span><code>/api/v1/reviews?cursor=0&amp;limit=20</code></div>
          <p>
            Authenticated campaign history. <code>limit</code> is 1-100 and
            <code>nextCursor</code> is null when no further records remain.
          </p>
          <div className="endpoint-title"><span className="method get">GET</span><code>/api/v1/campaign</code></div>
          <p>
            Returns the campaign configuration represented by the key plus API
            usage and quota counters.
          </p>
          <pre className="code-block">{`curl ${base}/api/v1/campaign \\
  -H "Authorization: Bearer $OSS_JUDGE_KEY"`}</pre>
        </section>

        <section id="integration">
          <div className="doc-icon"><RefreshCw size={19} /></div>
          <h2>Integration guide</h2>
          <h3>Recommended queue worker</h3>
          <p>
            Process campaign PRs through a durable queue. Keep one review write
            in flight per campaign when practical, store the returned review ID
            and transaction hash, and poll until the review is finalized or the
            transaction fails. This keeps budget allocation order predictable
            and avoids duplicate work.
          </p>
          <pre className="code-block">{`async function waitForReview(reviewId, transactionHash) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const response = await fetch(
      \`${base}/api/v1/reviews/\${reviewId}?transactionHash=\${transactionHash}\`
    );
    const body = await response.json();

    if (body.status === "finalized") return body.review;
    if (body.status === "failed") {
      throw new Error(body.transaction?.error?.message ?? "GenLayer review failed");
    }

    await new Promise((resolve) => setTimeout(resolve, 30_000));
  }
  throw new Error("Review is still pending; continue polling from a worker");
}`}</pre>
          <h3>Result fields to persist</h3>
          <div className="field-table">
            <div><code>reviewId</code><span>Stable on-chain review identifier.</span></div>
            <div><code>transactionHash</code><span>GenLayer transaction used to submit and poll consensus.</span></div>
            <div><code>candidates[].score</code><span>Normalized 0-100 quality score.</span></div>
            <div><code>candidates[].eligible</code><span>Whether the contribution passed the campaign eligibility decision.</span></div>
            <div><code>candidates[].recommended_usdc_micros</code><span>Suggested allocation in micro-USDC. Divide by 1,000,000 to display USDC.</span></div>
            <div><code>candidates[].citations</code><span>Exact fetched GitHub or supplementary evidence URLs supporting the judgment.</span></div>
            <div><code>review.result.explanation</code><span>Campaign-level comparative explanation returned by validators.</span></div>
          </div>
          <h3>Operational rules</h3>
          <ul className="docs-list">
            <li>Never put the campaign API key in browser code, public repositories, or client-side logs.</li>
            <li>Use HTTPS and redact authorization headers from observability systems.</li>
            <li>Store the review ID, transaction hash, resolved head SHA, status, and final result for auditability.</li>
            <li>Retry only errors marked retryable. Reuse the same idempotency key for transport retries.</li>
            <li>Do not treat a 202 response as a final judgment; poll the returned status URL.</li>
          </ul>
        </section>

        <section id="appeals">
          <div className="endpoint-title"><span className="method post">POST</span><code>/api/v1/reviews/:reviewId/appeals</code></div>
          <p>
            Creates an append-only review revision. Appeal context must contain
            20-4000 characters and should identify material evidence or acceptance
            criteria that the original review allegedly missed.
          </p>
          <pre className="code-block">{`curl -X POST ${base}/api/v1/reviews/$REVIEW_ID/appeals \\
  -H "Authorization: Bearer $OSS_JUDGE_KEY" \\
  -H "Idempotency-Key: appeal-$REVIEW_ID-01" \\
  -H "Content-Type: application/json" \\
  -d '{
    "organizationId": "grantfox",
    "appealContext": "Re-evaluate the immutable revision against the clarified acceptance criterion..."
  }'`}</pre>
        </section>

        <section id="webhooks">
          <div className="endpoint-title"><span className="method post">POST</span><code>/api/v1/webhook-endpoints</code></div>
          <p>
            Registers an HTTPS result destination for the organization. Deliveries
            are signed with the platform webhook secret. Consumers should verify
            signatures, deduplicate delivery IDs, and return a 2xx response.
          </p>
          <pre className="code-block">{`curl -X POST ${base}/api/v1/webhook-endpoints \\
  -H "Authorization: Bearer $OSS_JUDGE_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "organizationId": "grantfox",
    "endpointUrl": "https://example.org/webhooks/oss-judge"
  }'`}</pre>
        </section>

        <section id="errors">
          <h2>Error envelope</h2>
          <pre className="code-block">{`{
  "error": {
    "code": "INVALID_REQUEST",
    "message": "Request validation failed: Use the owner/repository format.",
    "request_id": "f4d0...",
    "retryable": false,
    "details": [{
      "path": ["candidates", 0, "repository"],
      "message": "Use the owner/repository format."
    }]
  }
}`}</pre>
          <div className="error-table">
            <div><code>400</code><span>Malformed JSON or invalid idempotency header.</span></div>
            <div><code>401</code><span>Missing, revoked, invalid campaign key, or invalid wallet signature.</span></div>
            <div><code>403</code><span>The campaign key lacks the required scope.</span></div>
            <div><code>404</code><span>Campaign, review, issue, repository, or pull request was not found.</span></div>
            <div><code>409</code><span>Duplicate immutable revision, optional stale head-SHA guard mismatch, or idempotency conflict.</span></div>
            <div><code>422</code><span>Field validation failed or required evidence is unavailable.</span></div>
            <div><code>502</code><span>GitHub or another evidence source returned an invalid response.</span></div>
            <div><code>503</code><span>Retryable GitHub, StudioNet, or source-rate-limit failure.</span></div>
          </div>
        </section>

        <section id="trust" className="trust-doc">
          <div className="doc-icon"><ShieldCheck size={19} /></div>
          <h2>Trust boundary</h2>
          <p>
            API keys authorize requests but never sign GenLayer transactions.
            The dedicated platform wallet only relays writes. The contract
            receives the immutable PR head resolved by the API, rejects
            incomplete patches, and validators
            independently fetch the issue, pull request patch, changed source,
            tests, manifests, CI, and supplementary evidence before deciding the
            score. The relayer cannot choose or alter the verdict, but it remains
            the operational trust boundary for dashboard authorization because
            user signature recovery is performed by the hosted API.
          </p>
        </section>
      </main>
    </div>
  );
}
