import { NextResponse } from "next/server";
import { requireWalletAction } from "@/lib/app-auth";
import { errorResponse, parseJson, requestId } from "@/lib/errors";
import {
  createDashboardCampaign,
  readOrganizationCampaigns,
  readReviewNonce,
} from "@/lib/genlayer";
import { campaignDashboardPayloadSchema } from "@/lib/schemas";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const requestIdentifier = requestId(request);
  try {
    const { id } = await context.params;
    const wallet = new URL(request.url).searchParams.get("wallet") ?? "";
    const [campaigns, nonce] = await Promise.all([
      readOrganizationCampaigns(id),
      readReviewNonce(wallet),
    ]);
    return NextResponse.json({ campaigns, nonce });
  } catch (error) {
    return errorResponse(error, requestIdentifier);
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const requestIdentifier = requestId(request);
  try {
    const { id } = await context.params;
    const envelope = await requireWalletAction(await parseJson(request), "campaign.create");
    const payload = campaignDashboardPayloadSchema.parse(envelope.payload);
    if (payload.organizationId !== id) throw new Error("Organization mismatch");
    const transactionHash = await createDashboardCampaign({
      campaignId: payload.id,
      organizationId: id,
      actorWallet: envelope.wallet,
      name: payload.name,
      budgetUsdcMicros: payload.budgetUsdcMicros,
      qualityThreshold: payload.qualityThreshold,
      rubricVersion: payload.rubricVersion,
      rubric: payload.rubric,
      keyHash: payload.keyHash,
      actionNonce: envelope.nonce,
    });
    return NextResponse.json(
      { campaignId: payload.id, status: "submitted", transactionHash },
      { status: 202 },
    );
  } catch (error) {
    return errorResponse(error, requestIdentifier);
  }
}
