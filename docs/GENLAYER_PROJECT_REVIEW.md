---
project_name: Open Source Bug Bounty Judge
review_status: needs_more_info
path: intelligent_contract
confidence: high_on_source_medium_on_submission
reviewed_at: 2026-07-29
---

# GenLayer Project Review

## Snapshot

Open Source Bug Bounty Judge is an API-first contribution review protocol for
OSS campaign operators and individual contributors. Organizations register
immutable GitHub pull-request revisions, GenLayer validators independently
fetch repository evidence, and the Intelligent Contract stores comparative
scorecards, rankings, citations, appeals, and exact micro-USDC allocation
recommendations. The platform does not execute payouts.

## Reviewer Orientation

The source appears strong and clearly above a decorative GenLayer integration.
GenLayer owns the contested judgment that determines contribution eligibility,
ranking, and recommended budget allocation. The public repository and
production application are now available; the remaining evidence gap is a real
public GitHub review transaction and its resulting on-chain citations.

## GenLayer Fit

GenLayer is central to the trust model. Contributors, maintainers, campaign
operators, and payout administrators can benefit from different outcomes, so a
single GrantFox-like operator should not privately decide which contributions
qualify or how a fixed budget is divided.

Removing GenLayer would replace the core product with a centralized AI review
service. The current design instead binds the judgment to immutable PR
revisions, requires validators to fetch current repository evidence, compares
candidates under one rubric, and stores the resulting recommendation on-chain.
The decision is advisory at the payout boundary, but it is value-bearing and
directly intended to influence reward allocation.

## Contract Engineering

The contract uses a pinned GenVM runner, real GenLayer storage, 10 public write
methods, 11 public views, bounded HTTP evidence retrieval, structured LLM
output normalization, prompt-injection instructions, fetched-URL citation
filtering, and `prompt_comparative` consensus over eligibility, threshold
crossing, score tolerance, ordering, and allocation invariants.

Contract-side controls now include:

- Recomputed campaign, individual, and appeal SHA-256 review identities.
- Immutable PR head-SHA verification against GitHub.
- Duplicate candidate ID and campaign PR rejection.
- Organization-namespaced idempotency records.
- On-chain rubric dimension bounds and exact total validation.
- Scoped API-key authorization, usage counters, and quotas.
- Append-only appeal revisions.
- Wallet review quotas.
- Platform-only webhook delivery marks and owner-controlled signer rotation.

The most valuable future contract improvement would be replacing the convenience
`prompt_comparative` wrapper with an explicit custom validator function that
independently compares normalized scorecards and error classes. The current
principle is substantive, but a custom comparator would make tolerance,
threshold, ordering, citation, and failure behavior easier to audit.

## Engineering Quality

The implementation is coherent across the contract, GenLayerJS adapter,
stateless Next.js API, Zod schemas, wallet-signature path, GitHub preflight,
frontend, webhooks, tests, OpenAPI document, deployment configuration, and
operator documentation.

Verified locally:

- ESLint passes.
- TypeScript checking passes.
- Six TypeScript/API tests pass.
- The Next.js production build passes.
- GenVM lint and semantic validation pass.
- Eleven direct-mode contract tests pass.
- The local health route and rendered application return HTTP 200.

CI now reproduces application and contract verification on GitHub. The remaining
engineering weakness is deployment evidence, not a missing local implementation.

## Strongest Positives

- Validators inspect the issue, PR revision, changed files, raw code, reviews,
  commits, manifests, CI, and optional Stellar evidence instead of trusting PR
  descriptions or claimed tests.
- The reward recommendation has exact deterministic invariants after the
  subjective score: no below-threshold allocation and complete integer budget
  allocation when at least one candidate qualifies.
- API keys do not sign GenLayer transactions. The platform signer is isolated
  server-side while authorization and usage remain verifiable on-chain.

## Main Concerns

- A real public GitHub review transaction and complete campaign review have not
  yet been published.
- Campaign dates are stored but not enforced by the contract.
- Optional Stellar evidence is supplied as bounded HTTPS URLs rather than
  normalized Horizon/Soroban records with domain-specific verification.
- Webhook delivery uses a latest-20 scan and a shared platform HMAC secret.

## Suggested Changes

### Completed during this review

- Recompute deterministic review keys inside the contract.
- Namespace idempotency keys by organization.
- Validate rubric scopes and totals inside the contract.
- Make public on-chain review reads available without an API key.
- Complete the three-stage campaign workflow in the frontend.
- Replace the route-summary OpenAPI response with a full OpenAPI 3.1 contract.
- Add direct tests for forged review keys, scopes, appeals, tenant isolation,
  rubric validation, and webhook authorization.
- Add GitHub Actions CI.
- Expand the README into an integration and operations manual.

### Required before submission

1. Publish one real public GitHub individual review and one multi-candidate campaign
   review.
2. Publish the resulting review IDs, transaction hashes, and citations.
3. Verify one signed webhook delivery and its on-chain delivery mark.

Completed deployment evidence:

- StudioNet contract address, deployment transaction, source, and schema are
  recorded in `deployment.studionet.json`.
- Public repository: `https://github.com/TS-mfon/Open-Source-Bug-Bounty-Judge`.
- Production API and frontend:
  `https://open-source-bug-bounty-judge.vercel.app`.
- Vercel health smoke test reports the configured contract and platform signer.

### Recommended hardening

- Use structured Stellar/Horizon/Soroban evidence adapters instead of arbitrary
  ecosystem links.
- Add SSRF protection for organization webhook endpoints.
- Add per-organization webhook signing keys or asymmetric signatures.
- Replace the latest-20 webhook scan with an on-chain cursor.
- Add public API-key revocation and replacement endpoints.
- Publish prompt and rubric hashes with every review.
- Add campaign date/cutoff enforcement when a stable contract time source is
  selected.
- Move contract ownership and relayer rotation behind a multisig or timelock
  before a production network launch.

## Human Verification Checklist

- Compare deployed source byte-for-byte with
  `contracts/contribution_review_protocol.py`.
- Confirm the deployed schema exposes all documented methods.
- Confirm the configured API signer matches `platform_wallet`.
- Submit a PR whose head SHA changes and verify the contract rejects it.
- Submit the same campaign revision twice and verify the existing review wins.
- Confirm qualifying allocations sum exactly to the campaign budget.
- Confirm an appeal leaves the original review unchanged.
- Confirm a forged review key is rejected by the contract.
- Verify webhook signatures against the raw request body.

## Provisional Scoring Proposal

This is a source-only proposal and must be repeated after public deployment
evidence is available.

```json
{
  "submission_id": "open-source-bug-bounty-judge-local",
  "decision": "more_info",
  "confidence": "high",
  "evidence_types": ["local_source", "local_tests", "local_build", "local_http_smoke", "studionet_deployment"],
  "builder_signal": true,
  "reasoning": "The source demonstrates meaningful GenLayer consensus over a contested, value-bearing OSS reward decision, strong evidence retrieval, substantive comparative validation, and coherent API/contract integration. Public repository, deployment, receipt, live app, and real transaction evidence are still required before an external submission can be finalized.",
  "staff_reply": "The implementation is substantial. Publish the current StudioNet deployment and one complete campaign review so the contract source, live method mapping, and final allocation can be verified externally.",
  "needs_parent_review": false,
  "points": null,
  "evidence_access": {
    "local_source": "reviewed",
    "public_repository": "not_available",
    "studionet_deployment": "reviewed",
    "live_application": "not_available"
  },
  "rubric_review": {
    "gate_failures": [],
    "sections": {
      "genlayer_fit": {
        "score": 4,
        "reason": "Neutral validators settle contribution eligibility, ranking, and reward allocation from independently fetched evidence.",
        "blocking_reason": ""
      },
      "contract_quality": {
        "score": 4,
        "reason": "The contract has bounded source retrieval, meaningful comparative consensus, normalized outputs, exact allocation invariants, and contract-side authorization and deduplication.",
        "blocking_reason": ""
      },
      "engineering": {
        "score": 4,
        "reason": "The stateless API, signer boundary, UI, tests, CI, OpenAPI contract, and operator documentation form a coherent implementation.",
        "blocking_reason": "Public deployment and repository evidence are not yet available."
      }
    },
    "extras": [],
    "overall_reason": "Source quality is strong, but submission evidence is incomplete until deployment and live transaction paths are independently reviewable."
  }
}
```

At `4/4/4`, the review-kit formula would produce 32 pre-multiplier points after
the project becomes eligible for an `accept` decision. No points should be
submitted while the deployment evidence remains unavailable.

## Evidence Access

- Local repository source: reviewed.
- Local GenVM lint and direct tests: reviewed.
- Local Next.js build, API, and rendered HTML: reviewed.
- GitHub repository URL: not available.
- StudioNet contract `0x1456602BD82695d5EAc97dCC41ecb761f66f2ca7`
  and deployment transaction
  `0x8c9c4b5fef3a1696adc94115b9782bebb8af380e6bd037569eced66b77012c72`:
  reviewed; execution succeeded with 5/5 validator agreement.
- Production application URL: not available.
