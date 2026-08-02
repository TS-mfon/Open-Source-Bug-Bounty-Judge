import { ApiError } from "./errors";
import type { ContributionInput } from "./types";
import type { z } from "zod";
import type { reviewCandidateIntentSchema } from "./schemas";

const headers = {
  Accept: "application/vnd.github+json",
  "User-Agent": "OpenSourceBugBountyJudge/1.0",
};

export async function preflightContribution(
  contribution: ContributionInput,
  options: { skipPullRequest?: boolean } = {},
) {
  const base = `https://api.github.com/repos/${contribution.repository}`;
  const [repository, issue, pull] = await Promise.all([
    fetch(base, { headers, cache: "no-store" }),
    fetch(`${base}/issues/${contribution.issueNumber}`, { headers, cache: "no-store" }),
    options.skipPullRequest
      ? Promise.resolve(null)
      : fetch(`${base}/pulls/${contribution.pullRequestNumber}`, {
          headers,
          cache: "no-store",
        }),
  ]);

  for (const [name, response] of [
    ["repository", repository],
    ["issue", issue],
    ["pull request", pull],
  ] as const) {
    if (!response) continue;
    if (response.status === 404) {
      throw new ApiError("EVIDENCE_NOT_FOUND", `GitHub ${name} was not found.`, 422);
    }
    if (response.status === 403 || response.status === 429) {
      throw new ApiError(
        "GITHUB_RATE_LIMITED",
        "GitHub evidence is temporarily rate limited.",
        503,
        true,
      );
    }
    if (!response.ok) {
      throw new ApiError(
        "GITHUB_UNAVAILABLE",
        `Unable to fetch GitHub ${name}.`,
        502,
        true,
      );
    }
  }

  if (!pull) return { pullAuthor: contribution.contributor };
  const pullData = (await pull.json()) as {
    head?: { sha?: string };
    user?: { login?: string };
  };
  if (pullData.head?.sha?.toLowerCase() !== contribution.headSha.toLowerCase()) {
    throw new ApiError(
      "HEAD_SHA_MISMATCH",
      "The submitted head SHA does not match the current pull request revision.",
      409,
      false,
      { currentHeadSha: pullData.head?.sha },
    );
  }
  return { pullAuthor: pullData.user?.login ?? "" };
}

export async function resolvePullRequestHead(
  repository: string,
  pullRequestNumber: number,
) {
  const response = await fetch(
    `https://api.github.com/repos/${repository}/pulls/${pullRequestNumber}`,
    { headers, cache: "no-store" },
  );
  if (response.status === 404) {
    throw new ApiError("EVIDENCE_NOT_FOUND", "GitHub pull request was not found.", 422);
  }
  if (response.status === 403 || response.status === 429) {
    throw new ApiError(
      "GITHUB_RATE_LIMITED",
      "GitHub evidence is temporarily rate limited.",
      503,
      true,
    );
  }
  if (!response.ok) {
    throw new ApiError("GITHUB_UNAVAILABLE", "Unable to resolve the pull request.", 502, true);
  }
  const pull = (await response.json()) as {
    head?: { sha?: string };
    user?: { login?: string };
  };
  const headSha = pull.head?.sha ?? "";
  if (!/^[0-9a-fA-F]{40}$/.test(headSha)) {
    throw new ApiError("INVALID_GITHUB_RESPONSE", "GitHub returned an invalid head SHA.", 502);
  }
  return { headSha, contributor: pull.user?.login ?? "" };
}

export type ReviewCandidateIntent = z.infer<typeof reviewCandidateIntentSchema>;

export async function resolveReviewCandidate(input: ReviewCandidateIntent) {
  let repository = input.repository ?? "";
  let pullRequestNumber = input.pullRequestNumber ?? 0;
  if (input.pullRequestUrl) {
    const parsed = new URL(input.pullRequestUrl);
    const parts = parsed.pathname.split("/").filter(Boolean);
    repository = `${parts[0]}/${parts[1]}`;
    pullRequestNumber = Number(parts[3]);
  }
  const resolved = await resolvePullRequestHead(repository, pullRequestNumber);
  if (input.headSha && input.headSha.toLowerCase() !== resolved.headSha.toLowerCase()) {
    throw new ApiError(
      "HEAD_SHA_MISMATCH",
      "The supplied head SHA does not match the current pull request revision.",
      409,
      false,
      { currentHeadSha: resolved.headSha },
    );
  }
  const id = input.id ?? `pr-${repository.replace("/", "-")}-${pullRequestNumber}`;
  return {
    id,
    repository,
    issueNumber: input.issueNumber,
    pullRequestNumber,
    headSha: resolved.headSha,
    contributor: input.contributor || resolved.contributor,
    contributionType: input.contributionType,
    stellarEvidenceUrls: input.stellarEvidenceUrls,
  } satisfies ContributionInput;
}
