import { NextResponse } from "next/server";
import { requireApiKey } from "@/lib/auth";
import {
  ApiError,
  errorResponse,
  parseJson,
  requestId,
  requireIdempotencyKey,
} from "@/lib/errors";
import { campaignReviewSchema } from "@/lib/schemas";
import {
  readCampaign,
  readCampaignContributions,
  readReviewByKey,
  submitCampaignReview,
} from "@/lib/genlayer";
import { campaignReviewKey } from "@/lib/hash";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const requestIdentifier = requestId(request);
  try {
    const key = await requireApiKey(request, "reviews:create");
    const idempotencyKey = requireIdempotencyKey(request);
    const { id } = await context.params;
    const input = campaignReviewSchema.parse(await parseJson(request));
    if (key.organization_id !== input.organizationId) {
      throw new ApiError("ORGANIZATION_MISMATCH", "Organization mismatch.", 403);
    }
    const [campaign, contributions] = await Promise.all([
      readCampaign(id),
      readCampaignContributions(id),
    ]);
    if (!campaign) throw new ApiError("CAMPAIGN_NOT_FOUND", "Campaign not found.", 404);
    if (campaign.rubric_version !== input.rubricVersion) {
      throw new ApiError(
        "RUBRIC_VERSION_MISMATCH",
        "The requested rubric version does not match the on-chain campaign.",
        409,
      );
    }
    if (contributions.length === 0) {
      throw new ApiError("NO_CONTRIBUTIONS", "Campaign has no contributions.", 422);
    }
    const deterministicKey = campaignReviewKey(
      input.organizationId,
      id,
      contributions,
      input.rubricVersion,
    );
    const existing = await readReviewByKey(deterministicKey);
    if (existing) {
      throw new ApiError(
        "REVIEW_ALREADY_EXISTS",
        "This campaign and pull-request revision set already has a review.",
        409,
        false,
        { reviewId: existing },
      );
    }
    const reviewId = `review_${deterministicKey}`;
    const transactionHash = await submitCampaignReview({
      reviewId,
      reviewKey: deterministicKey,
      campaignId: id,
      organizationId: input.organizationId,
      keyHash: key.key_hash,
      idempotencyKey,
      appealContext: input.appealContext,
    });
    return NextResponse.json(
      { reviewId, status: "submitted", transactionHash },
      { status: 202 },
    );
  } catch (error) {
    return errorResponse(error, requestIdentifier);
  }
}
