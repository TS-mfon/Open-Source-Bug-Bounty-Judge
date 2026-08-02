import { z } from "zod";

const trimmedString = z.string().trim();
const identifier = trimmedString
  .min(3, "Must contain at least 3 characters.")
  .max(96, "Must contain at most 96 characters.")
  .regex(
    /^[a-zA-Z0-9:_-]+$/,
    "Use only letters, numbers, colons, underscores, or hyphens.",
  );
const organizationIdentifier = trimmedString
  .min(3, "Must contain at least 3 characters.")
  .max(96, "Must contain at most 96 characters.")
  .regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers, or hyphens.");
const httpsUrl = trimmedString
  .url("Must be a valid URL.")
  .refine((value) => value.startsWith("https://"), "Must use HTTPS.");
const evidenceUrls = z.preprocess(
  (value) =>
    Array.isArray(value)
      ? value
          .map((item) => (typeof item === "string" ? item.trim() : item))
          .filter((item) => item !== "")
      : value,
  z.array(httpsUrl).max(6, "At most 6 evidence URLs are allowed.").default([]),
);
const campaignBudget = trimmedString
  .regex(/^[1-9][0-9]*$/, "Must be a positive integer.")
  .refine(
    (value) =>
      /^[1-9][0-9]*$/.test(value) && BigInt(value) >= 5_000_000_000n,
    "Campaign budget must be at least 5,000 USDC.",
  );

export const repositorySchema = trimmedString
  .regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/, "Use the owner/repository format.");

export const rubricSchema = z
  .record(z.string(), z.number().int().min(0).max(40))
  .refine((rubric) => Object.values(rubric).reduce((sum, value) => sum + value, 0) === 100, {
    message: "Rubric weights must total 100.",
  });

export const campaignSchema = z.object({
  id: identifier,
  organizationId: identifier,
  externalId: trimmedString.min(1).max(128),
  name: trimmedString.min(3).max(160),
  budgetUsdcMicros: campaignBudget,
  qualityThreshold: z.number().int().min(50).max(95).default(70),
  startsAt: z.iso.datetime(),
  endsAt: z.iso.datetime(),
  evidenceCutoff: z.iso.datetime(),
  rubricVersion: trimmedString.min(1).max(64).default("code-v1"),
  rubric: rubricSchema,
});

export const walletActionEnvelopeSchema = z.object({
  wallet: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  signature: z.string().regex(/^0x[0-9a-fA-F]+$/),
  action: z.string().min(3).max(64),
  payloadHash: z.string().regex(/^[0-9a-fA-F]{64}$/),
  nonce: z.number().int().nonnegative(),
  expiresAt: z.number().int().positive(),
  payload: z.unknown(),
});

export const profilePayloadSchema = z.object({
  defaultWorkspace: z.enum(["individual", "organization"]),
});

export const organizationPayloadSchema = z.object({
  id: organizationIdentifier,
  name: trimmedString.min(2).max(160),
});

export const memberPayloadSchema = z.object({
  organizationId: z.string().min(3).max(96),
  memberWallet: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  role: z.enum(["admin", "member"]),
});

export const campaignDashboardPayloadSchema = z.object({
  id: identifier,
  organizationId: identifier,
  name: trimmedString.min(3).max(160),
  budgetUsdcMicros: campaignBudget,
  qualityThreshold: z.number().int().min(50).max(95),
  rubricVersion: trimmedString.min(1).max(64).default("code-v1"),
  rubric: rubricSchema,
  keyHash: z.string().regex(/^[0-9a-fA-F]{64}$/),
});

export const campaignKeyRotationPayloadSchema = z.object({
  campaignId: z.string().min(3).max(96),
  organizationId: z.string().min(3).max(96),
  keyHash: z.string().regex(/^[0-9a-fA-F]{64}$/),
});

export const campaignKeyRevocationPayloadSchema = z.object({
  campaignId: z.string().min(3).max(96),
  organizationId: z.string().min(3).max(96),
});

export const contributionSchema = z.object({
  id: identifier,
  repository: repositorySchema,
  issueNumber: z.number().int().positive(),
  pullRequestNumber: z.number().int().positive(),
  headSha: z.string().regex(/^[0-9a-fA-F]{40}$/),
  contributor: trimmedString.min(1, "Contributor could not be resolved.").max(80),
  contributionType: z.enum([
    "code",
    "documentation",
    "design",
    "infrastructure",
    "security",
    "mixed",
  ]),
  stellarEvidenceUrls: evidenceUrls,
});

export const batchReviewSchema = z.object({
  candidates: z
    .array(contributionSchema)
    .length(1, "Submit exactly one pull request per review request."),
  appealContext: z.string().max(4000).default(""),
});

export const individualReviewIntentSchema = z.object({
  repository: repositorySchema,
  issueNumber: z.number().int().positive(),
  pullRequestNumber: z.number().int().positive(),
  contributor: trimmedString.max(80).default(""),
  contributionType: contributionSchema.shape.contributionType,
  stellarEvidenceUrls: evidenceUrls,
});

export const contributionsSchema = z.object({
  organizationId: z.string().min(3).max(96),
  contributions: z.array(contributionSchema).min(1).max(12),
});

export const campaignReviewSchema = z.object({
  organizationId: z.string().min(3).max(96),
  rubricVersion: z.string().min(1).max(64).default("code-v1"),
  appealContext: z.string().max(4000).default(""),
});

export const singleReviewSchema = z.object({
  wallet: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  signature: z.string().regex(/^0x[0-9a-fA-F]+$/),
  expiresAt: z.number().int().positive(),
  contribution: contributionSchema,
});

export const apiKeySchema = z.object({
  organizationId: z.string().min(3).max(96),
  organizationName: z.string().min(2).max(160),
  ownerWallet: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  scopes: z
    .array(
      z.enum([
        "campaigns:write",
        "reviews:create",
        "reviews:read",
        "appeals:create",
        "webhooks:manage",
      ]),
    )
    .min(1),
});

export const appealSchema = z.object({
  organizationId: z.string().min(3).max(96),
  appealContext: z.string().min(20).max(4000),
});

export const webhookSchema = z.object({
  organizationId: z.string().min(3).max(96),
  endpointUrl: z.url().startsWith("https://"),
});
