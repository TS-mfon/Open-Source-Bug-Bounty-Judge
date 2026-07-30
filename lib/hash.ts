import { createHash, randomBytes } from "node:crypto";
import type { ContributionInput } from "./types";

export function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value);
}

export function reviewKey(
  organizationId: string,
  campaignId: string,
  contribution: ContributionInput,
  rubricVersion: string,
  reviewKind: string,
) {
  return sha256(
    [
      organizationId,
      campaignId,
      contribution.repository.toLowerCase(),
      contribution.pullRequestNumber,
      contribution.headSha.toLowerCase(),
      rubricVersion,
      reviewKind,
    ].join("|"),
  );
}

export function campaignReviewKey(
  organizationId: string,
  campaignId: string,
  contributions: ContributionInput[],
  rubricVersion: string,
) {
  const candidates = contributions
    .map((candidate) =>
      reviewKey(organizationId, campaignId, candidate, rubricVersion, "campaign"),
    )
    .sort();
  return sha256([organizationId, campaignId, rubricVersion, ...candidates].join("|"));
}

export function generateApiKey() {
  return `osj_live_${randomBytes(24).toString("base64url")}`;
}
