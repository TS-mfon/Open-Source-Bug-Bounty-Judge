export type ContributionInput = {
  id: string;
  repository: string;
  issueNumber: number;
  pullRequestNumber: number;
  headSha: string;
  contributor: string;
  contributionType: "code" | "documentation" | "design" | "infrastructure" | "security" | "mixed";
  stellarEvidenceUrls?: string[];
};

export type CampaignInput = {
  id: string;
  name: string;
  externalId: string;
  budgetUsdcMicros: string;
  qualityThreshold: number;
  startsAt: string;
  endsAt: string;
  evidenceCutoff: string;
  rubric: Record<string, number>;
};

export type WalletProfile = {
  wallet: string;
  default_workspace: "individual" | "organization";
  active: boolean;
};

export type Organization = {
  id: string;
  name: string;
  creator_wallet: string;
  active: boolean;
};

export type MembershipRole = "creator" | "admin" | "member";

export type CampaignRecord = {
  id: string;
  organization_id: string;
  name: string;
  budget_usdc_micros: string;
  quality_threshold: number;
  rubric_version: string;
  rubric: Record<string, number>;
  status: string;
  active_api_key_hash: string;
  created_by: string;
  latest_review_id: string;
};

export type CandidateResult = {
  id: string;
  eligible: boolean;
  score: number;
  confidenceBps: number;
  rank: number;
  recommendedUsdcMicros: string;
  summary: string;
  strengths: string[];
  deficiencies: string[];
  flags: string[];
  citations: string[];
  dimensions: Record<string, number>;
};

export type StoredReview = {
  review_id: string;
  review_key: string;
  campaign_id: string;
  organization_id: string;
  status: "finalized" | "admin_review" | "inconclusive";
  budget_usdc_micros: string;
  result: {
    candidates: CandidateResult[];
    qualifying_count: number;
    total_allocated_usdc_micros: string;
    explanation: string;
  };
};

export type ApiErrorBody = {
  error: {
    code: string;
    message: string;
    request_id: string;
    retryable: boolean;
    details?: unknown;
  };
};
