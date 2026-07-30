import { describe, expect, it } from "vitest";
import { campaignReviewKey, reviewKey } from "./hash";

const contribution = {
  id: "candidate-1",
  repository: "GrantChain/GrantFox",
  issueNumber: 10,
  pullRequestNumber: 20,
  headSha: "a".repeat(40),
  contributor: "builder",
  contributionType: "code" as const,
};

describe("review keys", () => {
  it("are stable across repository casing", () => {
    expect(reviewKey("org", "campaign", contribution, "v1", "campaign")).toBe(
      reviewKey(
        "org",
        "campaign",
        { ...contribution, repository: "grantchain/grantfox" },
        "v1",
        "campaign",
      ),
    );
  });

  it("changes when the reviewed commit changes", () => {
    expect(reviewKey("org", "campaign", contribution, "v1", "campaign")).not.toBe(
      reviewKey(
        "org",
        "campaign",
        { ...contribution, headSha: "b".repeat(40) },
        "v1",
        "campaign",
      ),
    );
  });

  it("is independent of contribution ordering for campaign reviews", () => {
    const second = { ...contribution, id: "candidate-2", pullRequestNumber: 21 };
    expect(campaignReviewKey("org", "campaign", [contribution, second], "v1")).toBe(
      campaignReviewKey("org", "campaign", [second, contribution], "v1"),
    );
  });
});
