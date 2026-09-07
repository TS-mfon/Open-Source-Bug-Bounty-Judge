# Open Source Bug Bounty Judge

Open Source Bug Bounty Judge is a fully on-chain contribution review protocol
for open-source campaigns. Organizations create campaigns with a USDC-denominated
budget and quality threshold, then use a campaign-scoped API key to submit one
pull request per review. GenLayer validators fetch the repository evidence,
inspect the implementation, score qualifying work, and store an exact reward
allocation recommendation on-chain.

The protocol does not custody funds and does not execute payouts. Campaign
operators keep final payout authority.

- Application: https://open-source-bug-bounty-judge.vercel.app
- Source: https://github.com/TS-mfon/Open-Source-Bug-Bounty-Judge
- Network: GenLayer StudioNet
- Application database: none

## Current StudioNet Deployment

| Contract | Address | Deployment transaction |
|---|---|---|
| Organization Registry | `0xb41b8a86257885A47a46428FD35886fD7E1B6f5c` | `0xe360b7b6ecac179452616bf83c2dfc86fca0f318db0e789038b165c7624d7475` |
| Contribution Review Protocol | `0x50f2322A6572010804Bf46Ca790FE7C94A20C980` | `0x488b0f62531b5ba8f64713f37ff01908714369ce1f209f7f71fe15b77fac718d` |

Both deployments finalized and were verified by reading their deployed code and
contract schemas on August 2, 2026. The exact deployment record is stored in
[`deployment.studionet.json`](deployment.studionet.json).

The V1 contracts remain the active application deployment while the versioned
V2 protocol and directory are qualified. This preserves existing organizations,
campaigns, API-key hashes, and review history during migration. New traffic must
not be pointed at a fresh V2 protocol until the on-chain migration checklist is
complete.

The platform relayer wallet is:

```text
0x50BC1d91FfBB110E53ffD31Ad426d559f630b26E
```

## Product Boundary

The protocol answers:

1. Does each contribution satisfy the issue and campaign requirements?
2. Which contributions meet the campaign quality threshold?
3. Which 20, 40, or 60 USDC reward tier does each qualifying fix earn?

The protocol produces:

- Evidence-backed candidate scorecards.
- Eligibility and threshold decisions.
- A rank for the reviewed contribution.
- Exact micro-USDC recommendations.
- Citations to sources fetched during GenLayer execution.
- Append-only appeal results.
- Organization, campaign, and wallet review history.

The protocol does not:

- Transfer USDC.
- Hold campaign funds.
- merge pull requests.
- replace organization payout approval.
- trust a PR description or submitted test claim as proof.

## Architecture

```text
Browser wallet
  -> signs a short-lived dashboard action
  -> stateless Next.js relayer verifies the signature
  -> platform wallet signs the GenLayer transaction
  -> OrganizationRegistry or ContributionReviewProtocol

Campaign client
  -> sends campaign API key + review batch
  -> stateless API hashes and verifies the key on-chain
  -> platform wallet signs the GenLayer transaction
  -> validators fetch evidence and reach consensus
  -> result and indexes are stored on GenLayer
```

### Canonical state

All persistent application state is on GenLayer:

- Wallet profiles and default workspace.
- Organizations and immutable creators.
- Admin and member roles.
- Wallet action nonces.
- Campaign configuration.
- Campaign API-key hashes, scopes, status, usage, and quotas.
- Review identities and idempotency claims.
- Candidate inputs and finalized results.
- Organization, campaign, and wallet history indexes.
- Appeals.
- Webhook endpoints and delivery marks.

The Next.js application has no database, ORM, cache-backed authority, or hidden
review record. It can be replaced without migrating protocol state.

### Contracts

`OrganizationRegistry` owns:

- Individual or organization profiles.
- Organization creation.
- Creator, admin, and member roles.
- Membership indexes.
- Per-wallet replay-protection nonces.

`ContributionReviewProtocol` owns:

- Campaigns and campaign API keys.
- Review and appeal execution.
- Repository evidence acquisition.
- Comparative GenLayer judgment.
- Allocation arithmetic.
- Review indexes and webhook state.

Every write method on both contracts accepts transactions only from the platform
wallet. The initiating user wallet or API key remains recorded and authorized
inside the contract call.

## Trust Model

There are three distinct authorities:

| Authority | Capability | Cannot do |
|---|---|---|
| User wallet | Authorize dashboard actions | Submit GenLayer writes directly through the hosted app |
| Campaign API key | Authorize review, result, appeal, and webhook operations | Sign a GenLayer transaction |
| Platform wallet | Relay authorized writes | Select validator scores or rewrite finalized results |

The platform relayer is operationally trusted to submit requested transactions,
but it does not control the validator judgment. Contract access checks prevent
an API route from inventing organization authority.

For production-network use, platform ownership and relayer rotation should move
behind a multisig or timelock.

## Organization Workflow

1. Connect an EVM-compatible wallet.
2. Register an on-chain profile.
3. Select `Organization` as the default workspace.
4. Create an organization.
5. The creator is registered as the immutable organization creator and admin.
6. Add member wallets and assign `admin` or `member` roles.
7. Create a campaign through the progressive campaign wizard.
8. Store the generated API key when it is shown.
9. Submit review candidate batches through the public API.
10. Read finalized reviews from the organization history.

Organization creators cannot be demoted or removed. Creators and admins can add
wallets, change non-creator roles, rotate campaign keys, and revoke campaign
keys.

## Individual Workflow

An individual user can review one public pull request without creating an
organization or campaign:

1. Connect a wallet.
2. Enter the repository, issue number, and pull request number.
3. The backend resolves the current PR head SHA from GitHub.
4. The user signs the exact repository, PR number, and resolved SHA.
5. The platform wallet relays the GenLayer transaction.
6. The finalized result appears in the wallet's on-chain review history.

The form does not require a head SHA. The contributor field can also be left
empty and resolved from the pull request author.

## Campaign Model

Campaign creation is dashboard-only. It requires:

- Campaign name.
- Stable campaign ID.
- Budget in USDC.
- A budget of at least `5,000` USDC.
- Quality threshold from `50` to `95`.
- A rubric whose integer weights total exactly `100`.

Budgets are stored as micro-USDC strings:

```text
1 USDC = 1,000,000 micro-USDC
```

Each campaign receives one active API key. Only the SHA-256 hash is stored
on-chain. The plaintext is shown once and cannot be recovered. Rotation revokes
the previous key and shows a new plaintext key once. Revocation disables review
access until a new key is issued.

## Evidence Acquisition

The contract fetches evidence during validator execution. It does not accept
the PR description as the evidence bundle.

Required sources:

- Repository page.
- Original issue page.
- Pull request page.
- Pull request patch.
- Raw content for every fetchable changed file.

Additional bounded context:

- Repository README.
- `package.json` when present.
- Primary CI workflow when present.
- Up to six HTTPS Stellar or Soroban evidence URLs.

The contract resolves the pull-request head SHA from the fetched patch and
requires it to match the submitted revision identity before fetching immutable
raw source files. A truncated patch, missing patch SHA, or SHA mismatch causes
the transaction to roll back instead of allowing the model to score from
incomplete or user-provided prose.

All fetched text is treated as prompt-injection-capable, untrusted evidence.
The prompt explicitly forbids following instructions embedded in repositories,
issues, source files, comments, tests, or documentation.

### Fetch limits

- Each review request contains exactly one pull request.
- Maximum changed files per candidate: `12`.
- Maximum source characters per source: `14,000`.
- Maximum total source characters per candidate: `120,000`.
- Maximum Stellar evidence URLs: `6`.

The patch itself must fit within the bounded evidence limit. This is deliberate:
the contract does not silently review a partial diff.
- Immediate retries are limited to temporary `5xx` responses.
- `403` and `429` are classified as transient source-rate-limit failures.

Deleted files are reviewed from their patch content and do not require a raw
head-revision URL that no longer exists.

## Scoring And Allocation

Validators compare every candidate under the same campaign rubric. The result
for each candidate includes:

- `eligible`
- `score`
- `confidence_bps`
- `summary`
- dimension scores
- strengths
- deficiencies
- abuse or quality flags
- fetched-source citations
- rank
- recommended micro-USDC amount

The equivalence principle requires material agreement on:

- Eligibility.
- Threshold crossing.
- Whether the recommendation is zero or positive.
- The exact positive reward tier (`20`, `40`, or `60 USDC`).
- Major correctness and scope findings.
- Citation validity.
- Reward-cap and allocation invariants.

Reward selection is deterministic after validator scoring and cumulative campaign spend:

```text
lower quality band  = 20 USDC
middle quality band = 40 USDC
upper quality band  = 60 USDC
```

Only eligible candidates at or above the quality threshold receive a
recommendation. The three bands are calculated relative to the campaign
threshold, and the equivalence principle requires validators to agree on the
exact reward tier. Recommendations consume the campaign's remaining budget in
rank order across all reviews. The contract stores cumulative
`spent_usdc_micros` and will not create new positive recommendations beyond the
campaign budget. No
positive recommendation can be below 20 USDC or above 60 USDC; a remainder
below 20 USDC stays unallocated. If nobody qualifies, allocation remains zero
and the strongest three candidates are placed in the administrator-review
shortlist.

## Duplicate And Replay Protection

A campaign review identity commits to:

```text
organization ID
campaign ID
rubric version
sorted candidate revision identities
```

Each candidate revision identity commits to:

```text
repository
pull request number
head commit SHA
review kind
```

Protection exists at both API and contract layers:

- API preflight rejects stale PR head SHAs; the contract independently confirms
  the submitted SHA against the fetched patch before using immutable raw URLs.
- Duplicate candidate IDs are rejected.
- Duplicate immutable revisions in one batch are rejected.
- Existing review keys return `REVIEW_ALREADY_EXISTS`.
- On-chain review IDs and review keys are unique.
- Idempotency keys are namespaced by organization.
- Wallet actions consume per-wallet nonces.
- Wallet signatures expire after at most 15 minutes.
- Individual review quotas are enforced on-chain.

## Public API

Base URL:

```text
https://open-source-bug-bounty-judge.vercel.app/api/v1
```

Machine-readable specification:

```text
GET /api/v1/openapi
```

Interactive documentation is available at `/docs`.

### Authentication

Organization endpoints use a campaign key:

```http
Authorization: Bearer osj_live_...
```

Mutating organization requests also require:

```http
Idempotency-Key: your-stable-request-id
```

API keys never sign GenLayer transactions. The server verifies the on-chain key
record and relays the write with the platform wallet.

### Endpoint summary

| Method | Route | Authentication | Purpose |
|---|---|---|---|
| `POST` | `/reviews` | Campaign key | Submit one pull request for review |
| `GET` | `/reviews` | Campaign key | List reviews for the authenticated campaign |
| `GET` | `/reviews/{id}` | Public | Read a finalized result or sanitized transaction status |
| `POST` | `/reviews/{id}/appeals` | Campaign key | Submit an append-only appeal |
| `POST` | `/reviews/single` | Wallet signature | Submit an individual review |
| `GET` | `/campaign` | Campaign key | Read campaign configuration and key usage |
| `POST` | `/webhook-endpoints` | Campaign key | Configure organization result delivery |
| `GET` | `/health` | Public | Read service and contract configuration |
| `GET` | `/openapi` | Public | Read the OpenAPI 3.1 document |

Campaign creation and membership management are intentionally absent from the
public integration API. They are wallet-authorized dashboard operations.

### Submit a pull-request review

```bash
curl -X POST \
  https://open-source-bug-bounty-judge.vercel.app/api/v1/reviews \
  -H "Authorization: Bearer $OSS_JUDGE_KEY" \
  -H "Idempotency-Key: routedock-wave-001" \
  -H "Content-Type: application/json" \
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
  }'
```

The request contains exactly one pull request. GenLayer fetches the repository,
issue, pull-request page, and patch links directly. It does not depend on the
GitHub JSON pull-request API response being available or correctly formatted.

Accepted response:

```json
{
  "reviewId": "review_...",
  "campaignId": "routedock-issue-135",
  "status": "submitted",
  "transactionHash": "0x...",
  "statusUrl": "/api/v1/reviews/review_...?transactionHash=0x..."
}
```

`202 Accepted` means the transaction was submitted. It does not mean GenVM
execution succeeded. Poll `statusUrl` until the review record exists or the
sanitized transaction status reports failure.

### List campaign reviews

```bash
curl \
  "https://open-source-bug-bounty-judge.vercel.app/api/v1/reviews?cursor=0&limit=20" \
  -H "Authorization: Bearer $OSS_JUDGE_KEY"
```

### Read a result

```bash
curl \
  "https://open-source-bug-bounty-judge.vercel.app/api/v1/reviews/$REVIEW_ID?transactionHash=$TX_HASH"
```

Pending transaction responses contain only:

- transaction lifecycle status
- GenVM execution result
- consensus result
- result code
- normalized execution error

Raw validator configuration and consensus payloads are never returned by the
application API.

### Appeal a review

```bash
curl -X POST \
  "https://open-source-bug-bounty-judge.vercel.app/api/v1/reviews/$REVIEW_ID/appeals" \
  -H "Authorization: Bearer $OSS_JUDGE_KEY" \
  -H "Idempotency-Key: appeal-$REVIEW_ID-001" \
  -H "Content-Type: application/json" \
  -d '{
    "organizationId": "grantfox-live-20260801",
    "appealContext": "The original assessment missed the newly fetched integration evidence..."
  }'
```

Appeals do not overwrite the original review. They create a new review with a
`supersedes_review_id` reference.

## Error Model

All API errors use:

```json
{
  "error": {
    "code": "REVIEW_ALREADY_EXISTS",
    "message": "This exact candidate revision set has already been reviewed.",
    "request_id": "uuid",
    "retryable": false,
    "details": {
      "reviewId": "review_..."
    }
  }
}
```

Common codes:

| Code | Meaning | Retry |
|---|---|---|
| `INVALID_REQUEST` | Zod validation failed | Fix request |
| `INVALID_API_KEY` | Key is missing, unknown, or revoked | Replace key |
| `MISSING_SCOPE` | Key cannot perform the operation | Replace key |
| `HEAD_SHA_MISMATCH` | PR moved after the revision was selected | Resolve new SHA |
| `REVIEW_ALREADY_EXISTS` | Immutable candidate set was already reviewed | Use returned review |
| `GITHUB_RATE_LIMITED` | API preflight hit GitHub limits | Retry later |
| `[TRANSIENT] Source rate limited` | Validator evidence fetch hit a source limit | Retry with a new idempotency key after the source recovers |
| `[EXTERNAL]` | Required evidence is missing or invalid | Fix evidence |
| `[LLM_ERROR]` | Validator output failed contract normalization | Retry or appeal |

Request validation errors are non-retryable `422` responses. Unexpected server
errors do not expose stack traces or internal exception messages.

## Dashboard Wallet Authorization

Dashboard writes use an EIP-191 message:

```text
Open Source Bug Bounty Judge
Wallet: 0x...
Action: campaign.create
Payload hash: <sha256(canonical-json-payload)>
Nonce: 0
Expires at: <unix timestamp>
```

The signed envelope contains:

```json
{
  "wallet": "0x...",
  "signature": "0x...",
  "action": "campaign.create",
  "payloadHash": "...",
  "nonce": 0,
  "expiresAt": 1785540000,
  "payload": {}
}
```

The API verifies the signature and payload hash. The contract verifies the
actor role and consumes the corresponding nonce. Changing wallet accounts in
the browser updates the active app wallet immediately.

## Webhooks

Campaign keys include `webhooks:manage`. A configured endpoint must be public
HTTPS and pass SSRF checks.

Delivered payloads include:

```http
X-OSJ-Delivery-Id: <sha256>
X-OSJ-Timestamp: <unix timestamp>
X-OSJ-Signature: v1=<hmac-sha256>
```

The signature input is:

```text
<timestamp>.<raw request body>
```

Successful deliveries are marked on-chain. The current dispatcher scans the
latest 20 reviews and should be replaced with an on-chain cursor before high
volume production use.

## Local Development

Prerequisites:

- Node.js `24.x`.
- npm.
- `uvx`.
- GenLayer CLI for deployment inspection.
- An EVM-compatible browser wallet.

Install:

```bash
npm install
```

Create `.env.local`:

```bash
NEXT_PUBLIC_GENLAYER_CONTRACT_ADDRESS=0x50f2322A6572010804Bf46Ca790FE7C94A20C980
NEXT_PUBLIC_GENLAYER_REGISTRY_ADDRESS=0xb41b8a86257885A47a46428FD35886fD7E1B6f5c
NEXT_PUBLIC_GENLAYER_NETWORK=studionet
GENLAYER_PLATFORM_PRIVATE_KEY=0x...
WEBHOOK_SIGNING_SECRET=...
CRON_SECRET=...
```

Start:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

Never expose `GENLAYER_PLATFORM_PRIVATE_KEY` through a `NEXT_PUBLIC_` variable,
client component, build artifact, API response, log, or repository commit.

## Verification

Application:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Contracts:

```bash
uvx --from genvm-linter genvm-lint check contracts/organization_registry.py
uvx --from genvm-linter genvm-lint check contracts/contribution_review_protocol.py
uvx --from genlayer-test pytest -q contracts/tests/direct
```

The current direct suite covers:

- Profile registration.
- Organization creation.
- Creator immutability.
- Admin/member authorization.
- Nonce replay rejection.
- Campaign creation.
- API-key scope and quota checks.
- Duplicate review rejection.
- Forged review-key rejection.
- Evidence and prompt mocks.
- Allocation invariants.
- Appeals.

## Deployment

The contracts pin:

```text
py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6
```

Deployment order:

1. Deploy `OrganizationRegistry(platform_wallet)`.
2. Deploy `ContributionReviewProtocol(platform_wallet, registry_address)`.
3. Verify each GenVM execution result, not only transaction finalization.
4. Update both public contract address variables.
5. Configure the same variables in Vercel.
6. Run profile, organization, campaign, key, and real review smoke tests.

StudioNet is gasless but rate-limited. Wait for finalization between write
transactions and avoid parallel contract deployments or review batches.

## Vercel

Required production variables:

- `NEXT_PUBLIC_GENLAYER_CONTRACT_ADDRESS`
- `NEXT_PUBLIC_GENLAYER_REGISTRY_ADDRESS`
- `NEXT_PUBLIC_GENLAYER_NETWORK`
- `GENLAYER_PLATFORM_PRIVATE_KEY`
- `WEBHOOK_SIGNING_SECRET`
- `CRON_SECRET`

Deploy:

```bash
npx vercel --prod
```

Production smoke checks:

```text
/
/app
/docs
/api/v1/health
/api/v1/openapi
```

The health response must report both contracts configured and the platform
signer configured.

## Repository Layout

```text
app/
  api/app/                 wallet-authenticated dashboard relayer routes
  api/v1/                  campaign and individual review API
  app/                     operational dashboard
  docs/                    integration documentation
components/
  app-shell.tsx
  energy-field.tsx
  wallet-provider.tsx
contracts/
  organization_registry.py
  contribution_review_protocol.py
  tests/direct/
docs/
  GENLAYER_PROJECT_REVIEW.md
lib/
  app-auth.ts
  auth.ts
  genlayer.ts
  github.ts
  schemas.ts
plan.md
deployment.studionet.json
```

## Current Limits

- GitHub evidence must be public.
- A review request supports exactly one candidate.
- Large or binary pull requests may exceed the bounded evidence model.
- Optional Stellar evidence is HTTPS-based rather than a dedicated Horizon or
  Soroban proof adapter.
- StudioNet source and transaction rate limits can delay reviews.
- The platform wallet is a single relayer key.
- The V2 review-job and signer-control primitives are deployed separately while
  V1 remains active; durable asynchronous execution is enabled only after the
  V2 migration and executor release.
- Contract writes currently authenticate through the platform relayer plus
  on-chain actor-wallet/nonce checks; GenLayer does not yet provide a supported
  secp256k1 recovery primitive in this deployment, so the platform relayer
  remains an operational trust boundary for user-authenticated dashboard writes.
- Webhook delivery uses one platform HMAC secret.
- There is no event indexer; history is read from on-chain indexes.
- The protocol recommends allocations but does not enforce payout.

## Production Hardening Backlog

- Multisig or timelocked platform ownership.
- Per-organization asymmetric webhook keys.
- On-chain webhook cursor and retry schedule.
- Dedicated Horizon and Soroban evidence adapters.
- Configurable GitHub mirrors or authenticated source gateways.
- Campaign pause and close states.
- Organization audit events and role-change history.
- Per-campaign request quotas and spend controls.
- Prompt and evidence manifest hashes in every stored review.
- External payout adapters that consume finalized recommendations without
  giving the judge custody of campaign funds.

## License

Add the intended open-source license before production or third-party adoption.
