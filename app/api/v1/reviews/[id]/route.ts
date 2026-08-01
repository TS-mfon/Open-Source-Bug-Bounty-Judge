import { NextResponse } from "next/server";
import { errorResponse, requestId } from "@/lib/errors";
import { readReview } from "@/lib/genlayer";
import { pollReviewUntilSettled } from "@/lib/review-polling";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const requestIdentifier = requestId(request);
  try {
    const { id } = await context.params;
    const review = await readReview(id);
    if (review) {
      return NextResponse.json({ status: review.status, review });
    }
    const params = new URL(request.url).searchParams;
    const hash = params.get("transactionHash");
    if (!hash || !/^0x[0-9a-fA-F]{64}$/.test(hash)) {
      return NextResponse.json(
        { status: "pending" },
        { status: 202, headers: { "Retry-After": "30" } },
      );
    }
    const waitSeconds = Math.min(
      Math.max(Number(params.get("wait") ?? 0) || 0, 0),
      30,
    );
    const settled = await pollReviewUntilSettled(
      id,
      hash as `0x${string}`,
      { timeoutMs: waitSeconds * 1_000, intervalMs: 10_000 },
    );
    if (settled.status === "finalized") {
      return NextResponse.json({
        status: settled.review.status,
        review: settled.review,
      });
    }
    if (settled.status === "failed") {
      return NextResponse.json({
        status: "failed",
        transaction: settled.transaction,
      });
    }
    return NextResponse.json(
      { status: "submitted", transaction: settled.transaction },
      {
        status: 202,
        headers: { "Retry-After": "30" },
      },
    );
  } catch (error) {
    return errorResponse(error, requestIdentifier);
  }
}
