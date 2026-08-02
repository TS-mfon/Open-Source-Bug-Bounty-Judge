import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveReviewCandidate } from "./github";

afterEach(() => vi.unstubAllGlobals());

describe("review candidate resolution", () => {
  it("resolves a GitHub PR URL into an immutable contribution", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      head: { sha: "a".repeat(40) },
      user: { login: "TS-mfon" },
    }), { status: 200 })));

    const candidate = await resolveReviewCandidate({
      pullRequestUrl: "https://github.com/winsznx/routedock/pull/197",
      issueNumber: 135,
      contributor: "",
      contributionType: "code",
      stellarEvidenceUrls: [],
    });

    expect(candidate).toMatchObject({
      id: "pr-winsznx-routedock-197",
      repository: "winsznx/routedock",
      pullRequestNumber: 197,
      headSha: "a".repeat(40),
      contributor: "TS-mfon",
    });
  });

  it("rejects an optional stale SHA", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      head: { sha: "b".repeat(40) },
      user: { login: "TS-mfon" },
    }), { status: 200 })));

    await expect(resolveReviewCandidate({
      repository: "winsznx/routedock",
      pullRequestNumber: 197,
      issueNumber: 135,
      headSha: "a".repeat(40),
      contributor: "",
      contributionType: "code",
      stellarEvidenceUrls: [],
    })).rejects.toMatchObject({ code: "HEAD_SHA_MISMATCH", status: 409 });
  });
});
