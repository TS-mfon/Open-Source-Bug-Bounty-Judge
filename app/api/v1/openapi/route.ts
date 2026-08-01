import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  return NextResponse.json({
    openapi: "3.1.0",
    info: {
      title: "Open Source Bug Bounty Judge API",
      version: "1.0.0",
      description:
        "Campaign-scoped API for submitting complete comparative review batches and reading GenLayer results. Campaign creation is dashboard-only.",
    },
    servers: [{ url: `${origin}/api/v1` }],
    security: [{ ApiKey: [] }],
    paths: {
      "/reviews": {
        post: {
          summary: "Submit a comparative candidate batch",
          operationId: "submitReview",
          parameters: [{ $ref: "#/components/parameters/IdempotencyKey" }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/BatchReviewRequest" },
              },
            },
          },
          responses: {
            "202": {
              description: "Review transaction submitted",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/SubmittedReview" },
                },
              },
            },
            "409": { $ref: "#/components/responses/Conflict" },
            "422": { $ref: "#/components/responses/InvalidRequest" },
          },
        },
        get: {
          summary: "List reviews for the authenticated campaign",
          operationId: "listReviews",
          parameters: [
            { name: "cursor", in: "query", schema: { type: "integer", minimum: 0 } },
            { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100 } },
          ],
          responses: { "200": { description: "Campaign review history" } },
        },
      },
      "/reviews/{id}": {
        get: {
          summary: "Read a review or transaction status",
          operationId: "getReview",
          security: [],
          parameters: [
            { name: "id", in: "path", required: true, schema: { type: "string" } },
            { name: "transactionHash", in: "query", schema: { $ref: "#/components/schemas/Hash" } },
          ],
          responses: {
            "200": {
              description: "Finalized review",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ReviewResponse" },
                },
              },
            },
            "202": { description: "Transaction still pending or execution failed" },
          },
        },
      },
      "/reviews/{id}/appeals": {
        post: {
          summary: "Appeal a campaign review",
          operationId: "appealReview",
          parameters: [
            { name: "id", in: "path", required: true, schema: { type: "string" } },
            { $ref: "#/components/parameters/IdempotencyKey" },
          ],
          responses: { "202": { description: "Appeal submitted" } },
        },
      },
      "/reviews/single": {
        post: {
          summary: "Submit a wallet-authenticated individual review",
          operationId: "submitIndividualReview",
          security: [],
          responses: { "202": { description: "Individual review submitted" } },
        },
      },
      "/campaign": {
        get: {
          summary: "Read the campaign represented by the API key",
          operationId: "getCampaign",
          responses: { "200": { description: "Campaign and key usage" } },
        },
      },
      "/webhook-endpoints": {
        post: {
          summary: "Configure result webhooks",
          operationId: "setWebhookEndpoint",
          responses: { "202": { description: "Webhook endpoint submitted" } },
        },
      },
      "/health": {
        get: {
          summary: "Read service and contract configuration",
          operationId: "health",
          security: [],
          responses: { "200": { description: "Service health" } },
        },
      },
      "/openapi": {
        get: {
          summary: "Read this OpenAPI document",
          operationId: "openApi",
          security: [],
          responses: { "200": { description: "OpenAPI 3.1 document" } },
        },
      },
    },
    components: {
      securitySchemes: {
        ApiKey: { type: "http", scheme: "bearer", bearerFormat: "osj_live_..." },
      },
      parameters: {
        IdempotencyKey: {
          name: "Idempotency-Key",
          in: "header",
          required: true,
          schema: { type: "string", minLength: 8, maxLength: 128 },
        },
      },
      responses: {
        Conflict: { description: "Duplicate immutable revision set" },
        InvalidRequest: { description: "Invalid input or unavailable required evidence" },
      },
      schemas: {
        Hash: { type: "string", pattern: "^0x[0-9a-fA-F]{64}$" },
        Contribution: {
          type: "object",
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
            id: { type: "string" },
            repository: { type: "string", pattern: "^[^/]+/[^/]+$" },
            issueNumber: { type: "integer", minimum: 1 },
            pullRequestNumber: { type: "integer", minimum: 1 },
            headSha: { type: "string", pattern: "^[0-9a-fA-F]{40}$" },
            contributor: { type: "string" },
            contributionType: {
              type: "string",
              enum: ["code", "documentation", "design", "infrastructure", "security", "mixed"],
            },
            stellarEvidenceUrls: {
              type: "array",
              maxItems: 6,
              items: { type: "string", format: "uri" },
            },
          },
        },
        BatchReviewRequest: {
          type: "object",
          required: ["candidates"],
          properties: {
            candidates: {
              type: "array",
              minItems: 1,
              maxItems: 12,
              items: { $ref: "#/components/schemas/Contribution" },
            },
            appealContext: { type: "string", maxLength: 4000 },
          },
        },
        CandidateResult: {
          type: "object",
          properties: {
            id: { type: "string" },
            eligible: { type: "boolean" },
            score: { type: "integer", minimum: 0, maximum: 100 },
            rank: { type: "integer", minimum: 0 },
            recommended_usdc_micros: { type: "string" },
            summary: { type: "string" },
            dimensions: { type: "object", additionalProperties: { type: "integer" } },
            strengths: { type: "array", items: { type: "string" } },
            deficiencies: { type: "array", items: { type: "string" } },
            flags: { type: "array", items: { type: "string" } },
            citations: { type: "array", items: { type: "string", format: "uri" } },
          },
        },
        SubmittedReview: {
          type: "object",
          properties: {
            reviewId: { type: "string" },
            campaignId: { type: "string" },
            status: { const: "submitted" },
            transactionHash: { $ref: "#/components/schemas/Hash" },
            statusUrl: { type: "string" },
          },
        },
        ReviewResponse: {
          type: "object",
          properties: {
            status: { type: "string" },
            review: {
              type: "object",
              properties: {
                result: {
                  type: "object",
                  properties: {
                    candidates: {
                      type: "array",
                      items: { $ref: "#/components/schemas/CandidateResult" },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });
}
