import { NextResponse } from "next/server";
import { requireApiKey } from "@/lib/auth";
import { readCampaign, readCampaignContributions } from "@/lib/genlayer";
import { ApiError, errorResponse, requestId } from "@/lib/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const requestIdentifier = requestId(request);
  try {
    const key = await requireApiKey(request, "reviews:read");
    const { id } = await context.params;
    const campaign = await readCampaign(id);
    if (!campaign) throw new ApiError("CAMPAIGN_NOT_FOUND", "Campaign not found.", 404);
    if (campaign.organization_id !== key.organization_id) {
      throw new ApiError("FORBIDDEN", "This campaign belongs to another organization.", 403);
    }
    return NextResponse.json({
      campaign,
      contributions: await readCampaignContributions(id),
    });
  } catch (error) {
    return errorResponse(error, requestIdentifier);
  }
}
