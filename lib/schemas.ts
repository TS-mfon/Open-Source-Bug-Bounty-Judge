import { z } from "zod";

const repository = z
  .string()
  .regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/, "Use the owner/repository format.");

export const rubricSchema = z
  .record(z.string(), z.number().int().min(0).max(40))
  .refine((rubric) => Object.values(rubric).reduce((sum, value) => sum + value, 0) === 100, {
    message: "Rubric weights must total 100.",
  });

export const campaignSchema = z.object({
  id: z.string().min(3).max(96).regex(/^[a-zA-Z0-9:_-]+$/),
  organizationId: z.string().min(3).max(96).regex(/^[a-zA-Z0-9:_-]+$/),
  externalId: z.string().min(1).max(128),
  name: z.string().min(3).max(160),
  budgetUsdcMicros: z.string().regex(/^[1-9][0-9]*$/),
  qualityThreshold: z.number().int().min(50).max(95).default(70),
  startsAt: z.iso.datetime(),
  endsAt: z.iso.datetime(),
  evidenceCutoff: z.iso.datetime(),
  rubricVersion: z.string().min(1).max(64).default("code-v1"),
  rubric: rubricSchema,
});

export const contributionSchema = z.object({
  id: z.string().min(3).max(96).regex(/^[a-zA-Z0-9:_-]+$/),
  repository,
  issueNumber: z.number().int().positive(),
  pullRequestNumber: z.number().int().positive(),
  headSha: z.string().regex(/^[0-9a-fA-F]{40}$/),
  contributor: z.string().min(1).max(80),
  contributionType: z.enum([
    "code",
    "documentation",
    "design",
    "infrastructure",
    "security",
    "mixed",
  ]),
  stellarEvidenceUrls: z.array(z.url().startsWith("https://")).max(6).default([]),
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
