import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const jsonContent = (schema: Record<string, unknown>) => ({
  "application/json": { schema },
});

const errorResponses = {
  "400": { $ref: "#/components/responses/BadRequest" },
  "401": { $ref: "#/components/responses/Unauthorized" },
  "403": { $ref: "#/components/responses/Forbidden" },
  "404": { $ref: "#/components/responses/NotFound" },
  "409": { $ref: "#/components/responses/Conflict" },
  "422": { $ref: "#/components/responses/InvalidRequest" },
  "502": { $ref: "#/components/responses/ExecutionFailed" },
  "503": { $ref: "#/components/responses/Unavailable" },
};

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  return NextResponse.json({
    openapi: "3.1.0",
    info: {
      title: "Open Source Bug Bounty Judge API",
      version: "1.2.0",
      description:
        "Campaign-scoped API for submitting immutable pull-request review batches to GenLayer, polling consensus, reading evidence-backed results, appealing finalized reviews, and configuring result webhooks. Campaign creation and key management remain wallet-authenticated dashboard operations.",
    },
    servers: [{ url: `${origin}/api/v1`, description: "Current deployment" }],
    tags: [
      { name: "Reviews", description: "Submit and read GenLayer judgments." },
      { name: "Campaign", description: "Inspect the campaign represented by an API key." },
      { name: "Webhooks", description: "Configure an organization result endpoint." },
      { name: "Service", description: "Inspect API and contract configuration." },
    ],
    security: [{ ApiKey: [] }],
    paths: {
      "/reviews": {
        post: {
          tags: ["Reviews"],
          summary: "Submit one pull request for review",
          description:
            "Validates exactly one immutable GitHub pull-request revision, submits one GenLayer transaction, and waits up to 240 seconds for the finalized on-chain result. The contract inspects the repository, issue, pull-request page, and patch links directly. Use Prefer: respond-async to skip waiting or Prefer: wait=N to choose a shorter wait.",
          operationId: "submitReview",
          parameters: [
            { $ref: "#/components/parameters/IdempotencyKey" },
            { $ref: "#/components/parameters/PreferWait" },
          ],
          requestBody: {
            required: true,
            content: jsonContent({ $ref: "#/components/schemas/BatchReviewRequest" }),
          },
          responses: {
            "200": {
              description: "GenLayer review finalized within the request wait window.",
              content: jsonContent({ $ref: "#/components/schemas/CompletedReviewSubmission" }),
            },
            "202": {
              description:
                "Consensus continues on-chain. Poll Location or statusUrl every 30 seconds.",
              headers: {
                Location: { schema: { type: "string" } },
                "Retry-After": { schema: { type: "integer", const: 30 } },
              },
              content: jsonContent({ $ref: "#/components/schemas/SubmittedReview" }),
            },
            ...errorResponses,
          },
        },
        get: {
          tags: ["Reviews"],
          summary: "List campaign reviews",
          description:
            "Returns newest-first finalized reviews for the campaign represented by the bearer key.",
          operationId: "listReviews",
          parameters: [
            {
              name: "cursor",
              in: "query",
              description: "Zero-based result offset.",
              schema: { type: "integer", minimum: 0, default: 0 },
            },
            {
              name: "limit",
              in: "query",
              description: "Number of reviews to return.",
              schema: { type: "integer", minimum: 1, maximum: 100, default: 20 },
            },
          ],
          responses: {
            "200": {
              description: "Campaign review history.",
              content: jsonContent({ $ref: "#/components/schemas/ReviewListResponse" }),
            },
            "401": errorResponses["401"],
            "403": errorResponses["403"],
            "503": errorResponses["503"],
          },
        },
      },
      "/reviews/{id}": {
        get: {
          tags: ["Reviews"],
          summary: "Read review or transaction status",
          description:
            "Public polling endpoint. Returns 202 while consensus is pending, 200 with status failed when execution failed, or 200 with the canonical on-chain review after finalization.",
          operationId: "getReview",
          security: [],
          parameters: [
            { $ref: "#/components/parameters/ReviewId" },
            {
              name: "transactionHash",
              in: "query",
              description: "Hash returned by a submit endpoint. Include it while polling.",
              schema: { $ref: "#/components/schemas/Hash" },
            },
            {
              name: "wait",
              in: "query",
              description:
                "Optional long-poll duration in seconds. Values are capped at 30.",
              schema: { type: "integer", minimum: 0, maximum: 30, default: 0 },
            },
          ],
          responses: {
            "200": {
              description: "Finalized review or failed transaction.",
              content: jsonContent({
                oneOf: [
                  { $ref: "#/components/schemas/ReviewResponse" },
                  { $ref: "#/components/schemas/FailedTransactionResponse" },
                ],
              }),
            },
            "202": {
              description: "Review is not finalized yet.",
              content: jsonContent({ $ref: "#/components/schemas/PendingReviewResponse" }),
            },
            "503": errorResponses["503"],
          },
        },
      },
      "/reviews/{id}/appeals": {
        post: {
          tags: ["Reviews"],
          summary: "Appeal a campaign review",
          description:
            "Creates an append-only revision that supersedes the specified review. The review and API key must belong to organizationId.",
          operationId: "appealReview",
          parameters: [
            { $ref: "#/components/parameters/ReviewId" },
            { $ref: "#/components/parameters/IdempotencyKey" },
            { $ref: "#/components/parameters/PreferWait" },
          ],
          requestBody: {
            required: true,
            content: jsonContent({ $ref: "#/components/schemas/AppealRequest" }),
          },
          responses: {
            "200": {
              description: "Appeal finalized within the request wait window.",
              content: jsonContent({ $ref: "#/components/schemas/CompletedReviewSubmission" }),
            },
            "202": {
              description: "Appeal continues on-chain; poll statusUrl.",
              content: jsonContent({ $ref: "#/components/schemas/SubmittedAppeal" }),
            },
            ...errorResponses,
          },
        },
      },
      "/reviews/single": {
        post: {
          tags: ["Reviews"],
          summary: "Submit a wallet-authenticated individual review",
          description:
            "Submits one immutable contribution without a campaign key. Sign the documented wallet review message with the same wallet supplied in the body. Signatures expire after at most 15 minutes.",
          operationId: "submitIndividualReview",
          security: [],
          parameters: [{ $ref: "#/components/parameters/PreferWait" }],
          requestBody: {
            required: true,
            content: jsonContent({ $ref: "#/components/schemas/SingleReviewRequest" }),
          },
          responses: {
            "200": {
              description: "Individual review finalized within the request wait window.",
              content: jsonContent({ $ref: "#/components/schemas/CompletedReviewSubmission" }),
            },
            "202": {
              description: "Individual review continues on-chain; poll statusUrl.",
              content: jsonContent({ $ref: "#/components/schemas/SubmittedIndividualReview" }),
            },
            "401": errorResponses["401"],
            "409": errorResponses["409"],
            "422": errorResponses["422"],
            "503": errorResponses["503"],
          },
        },
      },
      "/campaign": {
        get: {
          tags: ["Campaign"],
          summary: "Read authenticated campaign",
          description:
            "Returns the on-chain campaign configuration and API-key usage counters for the bearer key.",
          operationId: "getCampaign",
          responses: {
            "200": {
              description: "Campaign and API-key usage.",
              content: jsonContent({ $ref: "#/components/schemas/CampaignResponse" }),
            },
            "401": errorResponses["401"],
            "403": errorResponses["403"],
            "503": errorResponses["503"],
          },
        },
      },
      "/webhook-endpoints": {
        post: {
          tags: ["Webhooks"],
          summary: "Configure result webhook",
          description:
            "Stores a public HTTPS endpoint for the authenticated organization. Private, loopback, link-local, and metadata-network destinations are rejected.",
          operationId: "setWebhookEndpoint",
          requestBody: {
            required: true,
            content: jsonContent({ $ref: "#/components/schemas/WebhookRequest" }),
          },
          responses: {
            "202": {
              description: "Webhook endpoint transaction submitted.",
              content: jsonContent({ $ref: "#/components/schemas/SubmittedWebhook" }),
            },
            "401": errorResponses["401"],
            "403": errorResponses["403"],
            "422": errorResponses["422"],
            "503": errorResponses["503"],
          },
        },
      },
      "/health": {
        get: {
          tags: ["Service"],
          summary: "Read service and contract configuration",
          operationId: "health",
          security: [],
          responses: {
            "200": {
              description: "Service health and signer configuration.",
              content: jsonContent({ $ref: "#/components/schemas/HealthResponse" }),
            },
          },
        },
      },
      "/openapi": {
        get: {
          tags: ["Service"],
          summary: "Read this OpenAPI document",
          operationId: "openApi",
          security: [],
          responses: { "200": { description: "OpenAPI 3.1 document." } },
        },
      },
    },
    components: {
      securitySchemes: {
        ApiKey: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "osj_live_...",
          description: "Campaign key revealed once in the dashboard.",
        },
      },
      parameters: {
        IdempotencyKey: {
          name: "Idempotency-Key",
          in: "header",
          required: true,
          description:
            "Unique logical request identifier. Reuse only when retrying the identical operation after transport uncertainty.",
          schema: { type: "string", minLength: 8, maxLength: 128 },
        },
        ReviewId: {
          name: "id",
          in: "path",
          required: true,
          description: "Review identifier returned by a submit endpoint.",
          schema: { type: "string", minLength: 3 },
        },
        PreferWait: {
          name: "Prefer",
          in: "header",
          required: false,
          description:
            "Default behavior waits up to 240 seconds for a finalized result. Use respond-async for an immediate 202, or wait=N for 0-240 seconds.",
          schema: {
            type: "string",
            examples: ["wait=120", "respond-async"],
          },
        },
      },
      responses: {
        BadRequest: {
          description: "Malformed JSON or invalid idempotency header.",
          content: jsonContent({ $ref: "#/components/schemas/ErrorResponse" }),
        },
        Unauthorized: {
          description: "Missing or invalid API key or wallet signature.",
          content: jsonContent({ $ref: "#/components/schemas/ErrorResponse" }),
        },
        Forbidden: {
          description: "Missing scope or organization mismatch.",
          content: jsonContent({ $ref: "#/components/schemas/ErrorResponse" }),
        },
        NotFound: {
          description: "Campaign, review, repository, issue, or pull request not found.",
          content: jsonContent({ $ref: "#/components/schemas/ErrorResponse" }),
        },
        Conflict: {
          description: "Duplicate immutable revision, stale SHA, or conflicting request.",
          content: jsonContent({ $ref: "#/components/schemas/ErrorResponse" }),
        },
        InvalidRequest: {
          description: "Field validation failed or required evidence was unavailable.",
          content: jsonContent({ $ref: "#/components/schemas/ErrorResponse" }),
        },
        ExecutionFailed: {
          description: "GenLayer consensus finalized an execution error.",
          content: jsonContent({ $ref: "#/components/schemas/FailedSubmission" }),
        },
        Unavailable: {
          description: "GenLayer, GitHub, or platform signer is temporarily unavailable.",
          content: jsonContent({ $ref: "#/components/schemas/ErrorResponse" }),
        },
      },
      schemas: {
        Hash: { type: "string", pattern: "^0x[0-9a-fA-F]{64}$" },
        WalletAddress: { type: "string", pattern: "^0x[0-9a-fA-F]{40}$" },
        Identifier: {
          type: "string",
          minLength: 3,
          maxLength: 96,
          pattern: "^[a-zA-Z0-9:_-]+$",
        },
        ReviewCandidateIntent: {
          type: "object",
          additionalProperties: false,
          required: [
            "issueNumber",
            "contributionType",
          ],
          anyOf: [
            { required: ["pullRequestUrl"] },
            { required: ["repository", "pullRequestNumber"] },
          ],
          properties: {
            id: { $ref: "#/components/schemas/Identifier" },
            pullRequestUrl: {
              type: "string",
              format: "uri",
              pattern: "^https://github\\.com/[^/]+/[^/]+/pull/[0-9]+",
              examples: ["https://github.com/winsznx/routedock/pull/197"],
            },
            repository: {
              type: "string",
              pattern: "^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$",
              examples: ["winsznx/routedock"],
            },
            issueNumber: { type: "integer", minimum: 1 },
            pullRequestNumber: { type: "integer", minimum: 1 },
            headSha: {
              type: "string",
              pattern: "^[0-9a-fA-F]{40}$",
              description: "Optional stale-revision guard. The API always resolves the current SHA.",
            },
            contributor: { type: "string", maxLength: 80, default: "" },
            contributionType: {
              type: "string",
              enum: ["code", "documentation", "design", "infrastructure", "security", "mixed"],
            },
            stellarEvidenceUrls: {
              type: "array",
              maxItems: 6,
              default: [],
              items: { type: "string", format: "uri", pattern: "^https://" },
            },
          },
        },
        BatchReviewRequest: {
          type: "object",
          additionalProperties: false,
          required: ["candidates"],
          properties: {
            candidates: {
              type: "array",
              minItems: 1,
              maxItems: 1,
              description: "Exactly one pull request per review request.",
              items: { $ref: "#/components/schemas/ReviewCandidateIntent" },
            },
            appealContext: { type: "string", maxLength: 4000, default: "" },
          },
        },
        SingleReviewRequest: {
          type: "object",
          additionalProperties: false,
          required: ["wallet", "signature", "expiresAt", "contribution"],
          properties: {
            wallet: { $ref: "#/components/schemas/WalletAddress" },
            signature: { type: "string", pattern: "^0x[0-9a-fA-F]+$" },
            expiresAt: {
              type: "integer",
              minimum: 1,
              description: "Unix timestamp no more than 15 minutes after signing.",
            },
            contribution: { $ref: "#/components/schemas/Contribution" },
          },
        },
        AppealRequest: {
          type: "object",
          additionalProperties: false,
          required: ["organizationId", "appealContext"],
          properties: {
            organizationId: { type: "string", minLength: 3, maxLength: 96 },
            appealContext: { type: "string", minLength: 20, maxLength: 4000 },
          },
        },
        WebhookRequest: {
          type: "object",
          additionalProperties: false,
          required: ["organizationId", "endpointUrl"],
          properties: {
            organizationId: { type: "string", minLength: 3, maxLength: 96 },
            endpointUrl: { type: "string", format: "uri", pattern: "^https://" },
          },
        },
        CandidateResult: {
          type: "object",
          required: [
            "id",
            "eligible",
            "score",
            "confidence_bps",
            "rank",
            "reward_tier_usdc_micros",
            "recommended_usdc_micros",
            "budget_limited",
          ],
          properties: {
            id: { type: "string" },
            eligible: { type: "boolean" },
            score: { type: "integer", minimum: 0, maximum: 100 },
            confidence_bps: { type: "integer", minimum: 0, maximum: 10000 },
            rank: { type: "integer", minimum: 0 },
            reward_tier_usdc_micros: {
              type: "string",
              enum: ["0", "20000000", "40000000", "60000000"],
              description: "Score-derived quality tier before campaign budget limiting.",
            },
            recommended_usdc_micros: {
              type: "string",
              pattern: "^[0-9]+$",
              description: "Zero, or a budget-aware recommendation from 20 to 60 USDC.",
            },
            budget_limited: {
              type: "boolean",
              description: "True when rank-order budget availability reduced or prevented payment.",
            },
            summary: { type: "string" },
            dimensions: { type: "object", additionalProperties: { type: "integer" } },
            strengths: { type: "array", items: { type: "string" } },
            deficiencies: { type: "array", items: { type: "string" } },
            flags: { type: "array", items: { type: "string" } },
            citations: { type: "array", items: { type: "string", format: "uri" } },
          },
        },
        StoredReview: {
          type: "object",
          required: ["review_id", "review_key", "campaign_id", "organization_id", "status", "result"],
          properties: {
            review_id: { type: "string" },
            review_key: { type: "string" },
            campaign_id: { type: "string" },
            organization_id: { type: "string" },
            status: { type: "string", enum: ["finalized", "admin_review", "inconclusive"] },
            budget_usdc_micros: { type: "string", pattern: "^[0-9]+$" },
            result: {
              type: "object",
              required: [
                "candidates",
                "qualifying_count",
                "paid_count",
                "total_allocated_usdc_micros",
                "unallocated_budget_usdc_micros",
              ],
              properties: {
                candidates: {
                  type: "array",
                  items: { $ref: "#/components/schemas/CandidateResult" },
                },
                qualifying_count: { type: "integer", minimum: 0 },
                paid_count: { type: "integer", minimum: 0 },
                total_allocated_usdc_micros: { type: "string", pattern: "^[0-9]+$" },
                unallocated_budget_usdc_micros: { type: "string", pattern: "^[0-9]+$" },
                explanation: { type: "string" },
              },
            },
          },
        },
        TransactionStatus: {
          type: "object",
          properties: {
            status: { type: "string" },
            executionResult: { type: "string" },
            consensusResult: { type: ["string", "null"] },
            resultCode: { type: ["integer", "null"] },
            error: {
              oneOf: [
                { type: "null" },
                {
                  type: "object",
                  properties: {
                    code: { type: ["string", "null"] },
                    message: { type: "string" },
                  },
                },
              ],
            },
          },
        },
        SubmittedReview: {
          type: "object",
          required: ["reviewId", "campaignId", "status", "transactionHash", "statusUrl"],
          properties: {
            reviewId: { type: "string" },
            campaignId: { type: "string" },
            status: { const: "submitted" },
            transactionHash: { $ref: "#/components/schemas/Hash" },
            statusUrl: { type: "string" },
          },
        },
        SubmittedIndividualReview: {
          type: "object",
          required: ["reviewId", "status", "transactionHash"],
          properties: {
            reviewId: { type: "string" },
            status: { const: "submitted" },
            transactionHash: { $ref: "#/components/schemas/Hash" },
            statusUrl: { type: "string" },
          },
        },
        SubmittedAppeal: {
          type: "object",
          required: ["reviewId", "supersedesReviewId", "status", "transactionHash"],
          properties: {
            reviewId: { type: "string" },
            supersedesReviewId: { type: "string" },
            status: { const: "submitted" },
            transactionHash: { $ref: "#/components/schemas/Hash" },
            statusUrl: { type: "string" },
          },
        },
        CompletedReviewSubmission: {
          type: "object",
          required: ["reviewId", "status", "transactionHash", "statusUrl", "review"],
          properties: {
            reviewId: { type: "string" },
            campaignId: { type: "string" },
            supersedesReviewId: { type: "string" },
            status: { type: "string", enum: ["finalized", "admin_review", "inconclusive"] },
            transactionHash: { $ref: "#/components/schemas/Hash" },
            statusUrl: { type: "string" },
            review: { $ref: "#/components/schemas/StoredReview" },
          },
        },
        FailedSubmission: {
          type: "object",
          required: ["reviewId", "status", "transactionHash", "statusUrl", "transaction"],
          properties: {
            reviewId: { type: "string" },
            campaignId: { type: "string" },
            supersedesReviewId: { type: "string" },
            status: { const: "failed" },
            transactionHash: { $ref: "#/components/schemas/Hash" },
            statusUrl: { type: "string" },
            transaction: { $ref: "#/components/schemas/TransactionStatus" },
          },
        },
        SubmittedWebhook: {
          type: "object",
          required: ["organizationId", "endpointUrl", "status", "transactionHash"],
          properties: {
            organizationId: { type: "string" },
            endpointUrl: { type: "string", format: "uri" },
            status: { const: "submitted" },
            transactionHash: { $ref: "#/components/schemas/Hash" },
          },
        },
        ReviewResponse: {
          type: "object",
          required: ["status", "review"],
          properties: {
            status: { type: "string" },
            review: { $ref: "#/components/schemas/StoredReview" },
          },
        },
        PendingReviewResponse: {
          type: "object",
          required: ["status"],
          properties: {
            status: { type: "string", enum: ["pending", "submitted"] },
            transaction: { $ref: "#/components/schemas/TransactionStatus" },
          },
        },
        FailedTransactionResponse: {
          type: "object",
          required: ["status", "transaction"],
          properties: {
            status: { const: "failed" },
            transaction: { $ref: "#/components/schemas/TransactionStatus" },
          },
        },
        ReviewListResponse: {
          type: "object",
          required: ["campaignId", "reviews", "nextCursor", "total"],
          properties: {
            campaignId: { type: "string" },
            reviews: {
              type: "array",
              items: { $ref: "#/components/schemas/StoredReview" },
            },
            nextCursor: { type: ["integer", "null"], minimum: 0 },
            total: { type: "integer", minimum: 0 },
          },
        },
        CampaignResponse: {
          type: "object",
          required: ["campaign", "apiKey"],
          properties: {
            campaign: {
              type: ["object", "null"],
              additionalProperties: true,
            description: "Campaign state includes budget_usdc_micros and cumulative spent_usdc_micros. Positive recommendations consume remaining budget across reviews; appeals replace the superseded allocation.",
            },
            apiKey: {
              type: "object",
              required: ["usageCount", "maxRequests"],
              properties: {
                usageCount: { type: "integer", minimum: 0 },
                maxRequests: { type: "integer", minimum: 0 },
              },
            },
          },
        },
        HealthResponse: {
          type: "object",
          required: [
            "ok",
            "service",
            "architecture",
            "network",
            "contractAddress",
            "registryAddress",
            "contractConfigured",
            "registryConfigured",
            "platformSignerConfigured",
            "timestamp",
          ],
          properties: {
            ok: { type: "boolean" },
            service: { type: "string" },
            architecture: { type: "string" },
            network: { type: "string" },
            contractAddress: { type: "string" },
            registryAddress: { type: "string" },
            contractConfigured: { type: "boolean" },
            registryConfigured: { type: "boolean" },
            platformSignerConfigured: { type: "boolean" },
            timestamp: { type: "string", format: "date-time" },
          },
        },
        ValidationIssue: {
          type: "object",
          properties: {
            path: {
              type: "array",
              items: { oneOf: [{ type: "string" }, { type: "integer" }] },
            },
            message: { type: "string" },
          },
        },
        ErrorResponse: {
          type: "object",
          required: ["error"],
          properties: {
            error: {
              type: "object",
              required: ["code", "message", "request_id", "retryable"],
              properties: {
                code: { type: "string" },
                message: { type: "string" },
                request_id: { type: "string" },
                retryable: { type: "boolean" },
                details: {
                  oneOf: [
                    { type: "array", items: { $ref: "#/components/schemas/ValidationIssue" } },
                    { type: "object", additionalProperties: true },
                    { type: "null" },
                  ],
                },
              },
            },
          },
        },
      },
    },
  });
}
