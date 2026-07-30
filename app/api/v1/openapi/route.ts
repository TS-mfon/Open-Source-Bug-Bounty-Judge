import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const errorResponse = {
  description: "Request failed",
  content: {
    "application/json": {
      schema: { $ref: "#/components/schemas/ErrorEnvelope" },
    },
  },
};

const bearerSecurity = [{ ApiKey: [] }];
const idempotencyHeader = {
  name: "Idempotency-Key",
  in: "header",
  required: true,
  description: "Unique key for this logical mutation. Reuse only after transport uncertainty.",
  schema: { type: "string", minLength: 8, maxLength: 128 },
};

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  return NextResponse.json({
    openapi: "3.1.0",
    info: {
      title: "Open Source Bug Bounty Judge API",
      version: "1.0.0",
      description:
        "Stateless API for GenLayer-backed contribution reviews and campaign allocation recommendations. All writes are relayed by the platform wallet and canonical state is stored on-chain.",
    },
    servers: [{ url: `${origin}/api/v1` }],
    tags: [
      { name: "Administration" },
      { name: "Campaigns" },
      { name: "Reviews" },
      { name: "Webhooks" },
      { name: "System" },
    ],
    paths: {
      "/admin/api-keys": {
        post: {
          tags: ["Administration"],
          summary: "Create an organization and its first API key",
          description:
            "The plaintext API key is returned once. Its SHA-256 hash and authorization record are stored on-chain.",
          security: [{ AdminSecret: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ApiKeyBootstrapInput" },
              },
            },
          },
          responses: {
            "202": {
              description: "Organization registration transaction submitted",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ApiKeyBootstrapAccepted" },
                },
              },
            },
            "400": errorResponse,
            "401": errorResponse,
            "409": errorResponse,
            "500": errorResponse,
          },
        },
      },
      "/campaigns": {
        post: {
          tags: ["Campaigns"],
          summary: "Create an on-chain campaign",
          security: bearerSecurity,
          parameters: [idempotencyHeader],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/CampaignInput" },
              },
            },
          },
          responses: {
            "202": {
              description: "Campaign transaction submitted",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/CampaignAccepted" },
                },
              },
            },
            "400": errorResponse,
            "401": errorResponse,
            "403": errorResponse,
            "409": errorResponse,
            "500": errorResponse,
          },
        },
      },
      "/campaigns/{id}": {
        get: {
          tags: ["Campaigns"],
          summary: "Read an organization campaign and its candidates",
          security: bearerSecurity,
          parameters: [{ $ref: "#/components/parameters/CampaignId" }],
          responses: {
            "200": {
              description: "Canonical campaign state",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/CampaignRead" },
                },
              },
            },
            "401": errorResponse,
            "403": errorResponse,
            "404": errorResponse,
            "500": errorResponse,
          },
        },
      },
      "/campaigns/{id}/contributions": {
        post: {
          tags: ["Campaigns"],
          summary: "Register immutable contribution candidates",
          description:
            "The API performs a GitHub accessibility and head-SHA preflight. Validators fetch evidence again during contract execution.",
          security: bearerSecurity,
          parameters: [
            { $ref: "#/components/parameters/CampaignId" },
            idempotencyHeader,
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ContributionsInput" },
              },
            },
          },
          responses: {
            "202": {
              description: "Candidate registration transaction submitted",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ContributionsAccepted" },
                },
              },
            },
            "400": errorResponse,
            "401": errorResponse,
            "403": errorResponse,
            "409": errorResponse,
            "422": errorResponse,
            "500": errorResponse,
            "503": errorResponse,
          },
        },
      },
      "/campaigns/{id}/reviews": {
        post: {
          tags: ["Reviews"],
          summary: "Start a comparative campaign review",
          security: bearerSecurity,
          parameters: [
            { $ref: "#/components/parameters/CampaignId" },
            idempotencyHeader,
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/CampaignReviewInput" },
              },
            },
          },
          responses: {
            "202": {
              description: "Review transaction submitted",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ReviewAccepted" },
                },
              },
            },
            "400": errorResponse,
            "401": errorResponse,
            "403": errorResponse,
            "404": errorResponse,
            "409": errorResponse,
            "422": errorResponse,
            "500": errorResponse,
          },
        },
      },
      "/reviews/{id}": {
        get: {
          tags: ["Reviews"],
          summary: "Read public review state or pending transaction state",
          parameters: [
            { $ref: "#/components/parameters/ReviewId" },
            {
              name: "transactionHash",
              in: "query",
              required: false,
              schema: { $ref: "#/components/schemas/TransactionHash" },
            },
          ],
          responses: {
            "200": {
              description: "Canonical review record",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ReviewRead" },
                },
              },
            },
            "202": {
              description: "Review record is not finalized yet",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/PendingReviewRead" },
                },
              },
            },
            "500": errorResponse,
          },
        },
      },
      "/reviews/{id}/appeals": {
        post: {
          tags: ["Reviews"],
          summary: "Create an evidence-backed appeal revision",
          security: bearerSecurity,
          parameters: [
            { $ref: "#/components/parameters/ReviewId" },
            idempotencyHeader,
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AppealInput" },
              },
            },
          },
          responses: {
            "202": {
              description: "Appeal transaction submitted",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/AppealAccepted" },
                },
              },
            },
            "400": errorResponse,
            "401": errorResponse,
            "403": errorResponse,
            "404": errorResponse,
            "409": errorResponse,
            "500": errorResponse,
          },
        },
      },
      "/reviews/single": {
        post: {
          tags: ["Reviews"],
          summary: "Submit a wallet-authenticated individual review",
          description:
            "The user signs a short-lived message. The platform wallet submits the GenLayer transaction.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SingleReviewInput" },
              },
            },
          },
          responses: {
            "202": {
              description: "Individual review transaction submitted",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ReviewAccepted" },
                },
              },
            },
            "400": errorResponse,
            "401": errorResponse,
            "409": errorResponse,
            "422": errorResponse,
            "500": errorResponse,
            "503": errorResponse,
          },
        },
      },
      "/webhook-endpoints": {
        post: {
          tags: ["Webhooks"],
          summary: "Set an organization webhook endpoint on-chain",
          security: bearerSecurity,
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/WebhookInput" },
              },
            },
          },
          responses: {
            "202": {
              description: "Webhook configuration transaction submitted",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/WebhookAccepted" },
                },
              },
            },
            "400": errorResponse,
            "401": errorResponse,
            "403": errorResponse,
            "500": errorResponse,
          },
        },
      },
      "/health": {
        get: {
          tags: ["System"],
          summary: "Read service and signer configuration status",
          responses: {
            "200": {
              description: "Service health",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/Health" },
                },
              },
            },
          },
        },
      },
      "/openapi": {
        get: {
          tags: ["System"],
          summary: "Read this OpenAPI document",
          responses: { "200": { description: "OpenAPI 3.1 document" } },
        },
      },
    },
    components: {
      securitySchemes: {
        ApiKey: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "osj_live_<secret>",
          description: "Scoped organization API key.",
        },
        AdminSecret: {
          type: "apiKey",
          in: "header",
          name: "x-admin-secret",
        },
      },
      parameters: {
        CampaignId: {
          name: "id",
          in: "path",
          required: true,
          schema: { type: "string", minLength: 3, maxLength: 96 },
        },
        ReviewId: {
          name: "id",
          in: "path",
          required: true,
          schema: { type: "string", minLength: 1, maxLength: 128 },
        },
      },
      schemas: {
        TransactionHash: {
          type: "string",
          pattern: "^0x[0-9a-fA-F]{64}$",
        },
        Address: {
          type: "string",
          pattern: "^0x[0-9a-fA-F]{40}$",
        },
        Identifier: {
          type: "string",
          minLength: 3,
          maxLength: 96,
          pattern: "^[a-zA-Z0-9:_-]+$",
        },
        Scope: {
          type: "string",
          enum: [
            "campaigns:write",
            "reviews:create",
            "reviews:read",
            "appeals:create",
            "webhooks:manage",
          ],
        },
        Rubric: {
          type: "object",
          minProperties: 1,
          maxProperties: 12,
          additionalProperties: {
            type: "integer",
            minimum: 0,
            maximum: 40,
          },
          description: "Integer dimension weights. Values must total exactly 100.",
        },
        Contribution: {
          type: "object",
          additionalProperties: false,
          required: [
            "id",
            "repository",
            "issueNumber",
            "pullRequestNumber",
            "headSha",
            "contributor",
            "contributionType",
          ],
          properties: {
            id: { $ref: "#/components/schemas/Identifier" },
            repository: {
              type: "string",
              pattern: "^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$",
            },
            issueNumber: { type: "integer", minimum: 1 },
            pullRequestNumber: { type: "integer", minimum: 1 },
            headSha: { type: "string", pattern: "^[0-9a-fA-F]{40}$" },
            contributor: { type: "string", minLength: 1, maxLength: 80 },
            contributionType: {
              type: "string",
              enum: [
                "code",
                "documentation",
                "design",
                "infrastructure",
                "security",
                "mixed",
              ],
            },
            stellarEvidenceUrls: {
              type: "array",
              maxItems: 6,
              items: { type: "string", format: "uri", pattern: "^https://" },
              default: [],
            },
          },
        },
        CampaignInput: {
          type: "object",
          additionalProperties: false,
          required: [
            "id",
            "organizationId",
            "externalId",
            "name",
            "budgetUsdcMicros",
            "qualityThreshold",
            "startsAt",
            "endsAt",
            "evidenceCutoff",
            "rubricVersion",
            "rubric",
          ],
          properties: {
            id: { $ref: "#/components/schemas/Identifier" },
            organizationId: { $ref: "#/components/schemas/Identifier" },
            externalId: { type: "string", minLength: 1, maxLength: 128 },
            name: { type: "string", minLength: 3, maxLength: 160 },
            budgetUsdcMicros: {
              type: "string",
              pattern: "^[1-9][0-9]*$",
              description: "Positive integer micro-USDC amount.",
            },
            qualityThreshold: { type: "integer", minimum: 50, maximum: 95 },
            startsAt: { type: "string", format: "date-time" },
            endsAt: { type: "string", format: "date-time" },
            evidenceCutoff: { type: "string", format: "date-time" },
            rubricVersion: { type: "string", minLength: 1, maxLength: 64 },
            rubric: { $ref: "#/components/schemas/Rubric" },
          },
        },
        ContributionsInput: {
          type: "object",
          additionalProperties: false,
          required: ["organizationId", "contributions"],
          properties: {
            organizationId: { $ref: "#/components/schemas/Identifier" },
            contributions: {
              type: "array",
              minItems: 1,
              maxItems: 12,
              items: { $ref: "#/components/schemas/Contribution" },
            },
          },
        },
        CampaignReviewInput: {
          type: "object",
          additionalProperties: false,
          required: ["organizationId", "rubricVersion"],
          properties: {
            organizationId: { $ref: "#/components/schemas/Identifier" },
            rubricVersion: { type: "string", minLength: 1, maxLength: 64 },
            appealContext: { type: "string", maxLength: 4000, default: "" },
          },
        },
        AppealInput: {
          type: "object",
          additionalProperties: false,
          required: ["organizationId", "appealContext"],
          properties: {
            organizationId: { $ref: "#/components/schemas/Identifier" },
            appealContext: { type: "string", minLength: 20, maxLength: 4000 },
          },
        },
        SingleReviewInput: {
          type: "object",
          additionalProperties: false,
          required: ["wallet", "signature", "expiresAt", "contribution"],
          properties: {
            wallet: { $ref: "#/components/schemas/Address" },
            signature: { type: "string", pattern: "^0x[0-9a-fA-F]+$" },
            expiresAt: {
              type: "integer",
              minimum: 1,
              description: "Unix timestamp no more than 15 minutes in the future.",
            },
            contribution: { $ref: "#/components/schemas/Contribution" },
          },
        },
        ApiKeyBootstrapInput: {
          type: "object",
          additionalProperties: false,
          required: ["organizationId", "organizationName", "ownerWallet", "scopes"],
          properties: {
            organizationId: { $ref: "#/components/schemas/Identifier" },
            organizationName: { type: "string", minLength: 2, maxLength: 160 },
            ownerWallet: { $ref: "#/components/schemas/Address" },
            scopes: {
              type: "array",
              minItems: 1,
              uniqueItems: true,
              items: { $ref: "#/components/schemas/Scope" },
            },
          },
        },
        WebhookInput: {
          type: "object",
          additionalProperties: false,
          required: ["organizationId", "endpointUrl"],
          properties: {
            organizationId: { $ref: "#/components/schemas/Identifier" },
            endpointUrl: { type: "string", format: "uri", pattern: "^https://" },
          },
        },
        TransactionAccepted: {
          type: "object",
          required: ["status", "transactionHash"],
          properties: {
            status: { type: "string", const: "submitted" },
            transactionHash: { $ref: "#/components/schemas/TransactionHash" },
          },
        },
        CampaignAccepted: {
          allOf: [
            { $ref: "#/components/schemas/TransactionAccepted" },
            {
              type: "object",
              required: ["campaignId"],
              properties: { campaignId: { type: "string" } },
            },
          ],
        },
        ContributionsAccepted: {
          allOf: [
            { $ref: "#/components/schemas/TransactionAccepted" },
            {
              type: "object",
              required: ["campaignId", "accepted"],
              properties: {
                campaignId: { type: "string" },
                accepted: { type: "integer", minimum: 1, maximum: 12 },
              },
            },
          ],
        },
        ReviewAccepted: {
          allOf: [
            { $ref: "#/components/schemas/TransactionAccepted" },
            {
              type: "object",
              required: ["reviewId"],
              properties: { reviewId: { type: "string" } },
            },
          ],
        },
        AppealAccepted: {
          allOf: [
            { $ref: "#/components/schemas/ReviewAccepted" },
            {
              type: "object",
              required: ["supersedesReviewId"],
              properties: { supersedesReviewId: { type: "string" } },
            },
          ],
        },
        ApiKeyBootstrapAccepted: {
          type: "object",
          required: ["organizationId", "apiKey", "scopes", "transactionHash", "warning"],
          properties: {
            organizationId: { type: "string" },
            apiKey: { type: "string", pattern: "^osj_live_" },
            scopes: {
              type: "array",
              items: { $ref: "#/components/schemas/Scope" },
            },
            transactionHash: { $ref: "#/components/schemas/TransactionHash" },
            warning: { type: "string" },
          },
        },
        WebhookAccepted: {
          allOf: [
            { $ref: "#/components/schemas/TransactionAccepted" },
            {
              type: "object",
              required: ["organizationId", "endpointUrl"],
              properties: {
                organizationId: { type: "string" },
                endpointUrl: { type: "string", format: "uri" },
              },
            },
          ],
        },
        CandidateResult: {
          type: "object",
          required: [
            "id",
            "eligible",
            "score",
            "meets_threshold",
            "confidence_bps",
            "rank",
            "recommended_usdc_micros",
            "summary",
            "strengths",
            "deficiencies",
            "flags",
            "citations",
            "dimensions",
          ],
          properties: {
            id: { type: "string" },
            eligible: { type: "boolean" },
            score: { type: "integer", minimum: 0, maximum: 100 },
            meets_threshold: { type: "boolean" },
            confidence_bps: { type: "integer", minimum: 0, maximum: 10000 },
            rank: { type: "integer", minimum: 0 },
            recommended_usdc_micros: { type: "string", pattern: "^[0-9]+$" },
            summary: { type: "string" },
            strengths: { type: "array", items: { type: "string" } },
            deficiencies: { type: "array", items: { type: "string" } },
            flags: { type: "array", items: { type: "string" } },
            citations: {
              type: "array",
              items: { type: "string", format: "uri" },
            },
            dimensions: {
              type: "object",
              additionalProperties: {
                type: "integer",
                minimum: 0,
                maximum: 100,
              },
            },
          },
        },
        StoredReview: {
          type: "object",
          required: [
            "review_id",
            "review_key",
            "campaign_id",
            "organization_id",
            "status",
            "budget_usdc_micros",
            "result",
          ],
          properties: {
            review_id: { type: "string" },
            review_key: { type: "string" },
            campaign_id: { type: "string" },
            organization_id: { type: "string" },
            requester_wallet: { type: "string" },
            status: {
              type: "string",
              enum: ["finalized", "admin_review", "inconclusive"],
            },
            budget_usdc_micros: { type: "string", pattern: "^[0-9]+$" },
            appeal_context: { type: "string" },
            supersedes_review_id: { type: "string" },
            result: {
              type: "object",
              required: [
                "status",
                "candidates",
                "qualifying_count",
                "total_allocated_usdc_micros",
                "shortlist",
                "explanation",
              ],
              properties: {
                status: { type: "string", enum: ["finalized", "admin_review"] },
                candidates: {
                  type: "array",
                  items: { $ref: "#/components/schemas/CandidateResult" },
                },
                qualifying_count: { type: "integer", minimum: 0 },
                total_allocated_usdc_micros: {
                  type: "string",
                  pattern: "^[0-9]+$",
                },
                shortlist: { type: "array", items: { type: "string" } },
                explanation: { type: "string" },
              },
            },
          },
        },
        ReviewRead: {
          type: "object",
          required: ["status", "review"],
          properties: {
            status: {
              type: "string",
              enum: ["finalized", "admin_review", "inconclusive"],
            },
            review: { $ref: "#/components/schemas/StoredReview" },
          },
        },
        PendingReviewRead: {
          type: "object",
          required: ["status"],
          properties: {
            status: { type: "string", enum: ["pending", "submitted"] },
            transaction: {
              type: "object",
              properties: {
                status: { type: "string" },
                executionResult: { type: "string" },
              },
            },
          },
        },
        CampaignRead: {
          type: "object",
          required: ["campaign", "contributions"],
          properties: {
            campaign: { type: "object", additionalProperties: true },
            contributions: {
              type: "array",
              items: { $ref: "#/components/schemas/Contribution" },
            },
          },
        },
        Health: {
          type: "object",
          required: [
            "ok",
            "service",
            "architecture",
            "network",
            "contractAddress",
            "contractConfigured",
            "platformSignerConfigured",
            "timestamp",
          ],
          properties: {
            ok: { type: "boolean" },
            service: { type: "string" },
            architecture: { type: "string" },
            network: { type: "string" },
            contractAddress: { $ref: "#/components/schemas/Address" },
            contractConfigured: { type: "boolean" },
            platformSignerConfigured: { type: "boolean" },
            timestamp: { type: "string", format: "date-time" },
          },
        },
        ErrorEnvelope: {
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
                details: {},
              },
            },
          },
        },
      },
    },
  });
}
