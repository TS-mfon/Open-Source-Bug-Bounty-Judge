import { NextResponse } from "next/server";
import { requireWalletAction } from "@/lib/app-auth";
import { ApiError, errorResponse, parseJson, requestId } from "@/lib/errors";
import { revokeCampaignKey, rotateCampaignKey } from "@/lib/genlayer";
import {
  campaignKeyRevocationPayloadSchema,
  campaignKeyRotationPayloadSchema,
} from "@/lib/schemas";

export const runtime = "nodejs";
export const maxDuration = 60;

type Context = {
  params: Promise<{ id: string; campaignId: string }>;
};

export async function PATCH(request: Request, context: Context) {
  const id = requestId(request);
  try {
    const { id: organizationId, campaignId } = await context.params;
    const envelope = await requireWalletAction(
      await parseJson(request),
      "campaign.key.rotate",
    );
    const payload = campaignKeyRotationPayloadSchema.parse(envelope.payload);
    if (
      payload.organizationId !== organizationId ||
      payload.campaignId !== campaignId
    ) {
      throw new ApiError("CAMPAIGN_MISMATCH", "Campaign or organization mismatch.", 403);
    }
    const transactionHash = await rotateCampaignKey({
      campaignId,
      organizationId,
      actorWallet: envelope.wallet,
      keyHash: payload.keyHash,
      actionNonce: envelope.nonce,
    });
    return NextResponse.json(
      { campaignId, status: "submitted", transactionHash },
      { status: 202 },
    );
  } catch (error) {
    return errorResponse(error, id);
  }
}

export async function DELETE(request: Request, context: Context) {
  const id = requestId(request);
  try {
    const { id: organizationId, campaignId } = await context.params;
    const envelope = await requireWalletAction(
      await parseJson(request),
      "campaign.key.revoke",
    );
    const payload = campaignKeyRevocationPayloadSchema.parse(envelope.payload);
    if (
      payload.organizationId !== organizationId ||
      payload.campaignId !== campaignId
    ) {
      throw new ApiError("CAMPAIGN_MISMATCH", "Campaign or organization mismatch.", 403);
    }
    const transactionHash = await revokeCampaignKey({
      campaignId,
      organizationId,
      actorWallet: envelope.wallet,
      actionNonce: envelope.nonce,
    });
    return NextResponse.json(
      { campaignId, status: "submitted", transactionHash },
      { status: 202 },
    );
  } catch (error) {
    return errorResponse(error, id);
  }
}
