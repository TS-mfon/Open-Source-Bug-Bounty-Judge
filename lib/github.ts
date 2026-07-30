import { ApiError } from "./errors";
import type { ContributionInput } from "./types";

const headers = {
  Accept: "application/vnd.github+json",
  "User-Agent": "OpenSourceBugBountyJudge/1.0",
};

export async function preflightContribution(contribution: ContributionInput) {
  const base = `https://api.github.com/repos/${contribution.repository}`;
  const [repository, issue, pull] = await Promise.all([
    fetch(base, { headers, cache: "no-store" }),
    fetch(`${base}/issues/${contribution.issueNumber}`, { headers, cache: "no-store" }),
    fetch(`${base}/pulls/${contribution.pullRequestNumber}`, {
      headers,
      cache: "no-store",
    }),
  ]);

  for (const [name, response] of [
    ["repository", repository],
    ["issue", issue],
    ["pull request", pull],
  ] as const) {
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
