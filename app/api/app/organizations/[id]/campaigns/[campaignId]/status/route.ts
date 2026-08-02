import { NextResponse } from "next/server";
import { ApiError, errorResponse, requestId } from "@/lib/errors";
import { readCampaign, readTransaction } from "@/lib/genlayer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string; campaignId: string }> };

function isFailed(transaction: Awaited<ReturnType<typeof readTransaction>>) {
  return (
    transaction.status === "FINALIZED" &&
    (transaction.executionResult === "FINISHED_WITH_ERROR" ||
      transaction.consensusResult === "MAJORITY_DISAGREE" ||
      transaction.consensusResult === "NO_MAJORITY" ||
      transaction.consensusResult === "TIMEOUT" ||
      transaction.consensusResult === "DETERMINISTIC_VIOLATION")
  );
}

export async function GET(request: Request, context: Context) {
  const id = requestId(request);
  try {
    const { id: organizationId, campaignId } = await context.params;
    const params = new URL(request.url).searchParams;
    const transactionHash = params.get("transactionHash") ?? "";
    const expectedKeyHash = params.get("expectedKeyHash") ?? "";
    if (!/^0x[0-9a-fA-F]{64}$/.test(transactionHash)) {
      throw new ApiError("INVALID_TRANSACTION_HASH", "A valid transaction hash is required.", 422);
    }
    if (!/^[0-9a-fA-F]{64}$/.test(expectedKeyHash)) {
      throw new ApiError("INVALID_KEY_HASH", "A valid expected key hash is required.", 422);
    }
    const [transaction, campaign] = await Promise.all([
      readTransaction(transactionHash as `0x${string}`),
      readCampaign(campaignId),
    ]);
    if (campaign && String(campaign.organization_id) !== organizationId) {
      throw new ApiError("CAMPAIGN_MISMATCH", "Campaign does not belong to this organization.", 403);
    }
    if (isFailed(transaction)) {
      return NextResponse.json({
        campaignId,
        status: "failed",
        transactionHash,
        error: transaction.error ?? { message: "GenLayer campaign transaction failed." },
      });
    }
    if (campaign && String(campaign.active_api_key_hash).toLowerCase() === expectedKeyHash.toLowerCase()) {
      return NextResponse.json({ campaignId, status: "finalized", transactionHash, campaign });
    }
    return NextResponse.json({
      campaignId,
      status: "pending",
      transactionHash,
      transaction: {
        status: transaction.status,
        consensusResult: transaction.consensusResult,
      },
      keyHashMatches: false,
    });
  } catch (error) {
    return errorResponse(error, id);
  }
}
