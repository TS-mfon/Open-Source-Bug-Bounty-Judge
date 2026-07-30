import { requireApiKey } from "@/lib/auth";
import {
  ApiError,
  errorResponse,
  parseJson,
  requestId,
  requireIdempotencyKey,
} from "@/lib/errors";
import { readReview, submitCampaignAppeal } from "@/lib/genlayer";
import { appealSchema } from "@/lib/schemas";
import { sha256 } from "@/lib/hash";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const requestIdentifier = requestId(request);
  try {
    const key = await requireApiKey(request, "appeals:create");
    const idempotencyKey = requireIdempotencyKey(request);
    const { id } = await context.params;
    const input = appealSchema.parse(await parseJson(request));
    if (key.organization_id !== input.organizationId) {
      throw new ApiError("ORGANIZATION_MISMATCH", "Organization mismatch.", 403);
    }
    const original = await readReview(id);
    if (!original) throw new ApiError("REVIEW_NOT_FOUND", "Review not found.", 404);
    if (original.organization_id !== input.organizationId) {
      throw new ApiError("FORBIDDEN", "This review belongs to another organization.", 403);
    }
    const reviewKey = sha256(
      [id, input.organizationId, input.appealContext.trim()].join("|"),
    );
    const reviewId = `appeal_${reviewKey}`;
    const transactionHash = await submitCampaignAppeal({
      reviewId,
      reviewKey,
      originalReviewId: id,
      organizationId: input.organizationId,
      keyHash: key.key_hash,
      idempotencyKey,
      appealContext: input.appealContext,
    });
    return NextResponse.json(
      { reviewId, supersedesReviewId: id, status: "submitted", transactionHash },
      { status: 202 },
    );
  } catch (error) {
    return errorResponse(error, requestIdentifier);
  }
}
