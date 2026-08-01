import { NextResponse } from "next/server";
import { requireApiKey } from "@/lib/auth";
import { errorResponse, requestId } from "@/lib/errors";
import { readCampaign } from "@/lib/genlayer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const id = requestId(request);
  try {
    const key = await requireApiKey(request, "reviews:read");
    return NextResponse.json({
      campaign: await readCampaign(key.campaign_id),
      apiKey: {
        usageCount: key.usage_count ?? 0,
        maxRequests: key.max_requests ?? 0,
      },
    });
  } catch (error) {
    return errorResponse(error, id);
  }
}
