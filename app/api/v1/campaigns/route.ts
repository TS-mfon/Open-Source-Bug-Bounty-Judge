import { NextResponse } from "next/server";
import { requireApiKey } from "@/lib/auth";
import { createCampaign } from "@/lib/genlayer";
import {
  errorResponse,
  parseJson,
  requestId,
  requireIdempotencyKey,
} from "@/lib/errors";
import { campaignSchema } from "@/lib/schemas";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const id = requestId(request);
  try {
    const key = await requireApiKey(request, "campaigns:write");
    const idempotencyKey = requireIdempotencyKey(request);
    const input = campaignSchema.parse(await parseJson(request));
    if (key.organization_id !== input.organizationId) {
      return NextResponse.json(
        {
          error: {
            code: "ORGANIZATION_MISMATCH",
            message: "The API key cannot create campaigns for this organization.",
            request_id: id,
            retryable: false,
          },
        },
        { status: 403 },
      );
    }
    const transactionHash = await createCampaign(
      input.organizationId,
      input,
      input.rubricVersion,
      key.key_hash,
      idempotencyKey,
    );
    return NextResponse.json(
      { campaignId: input.id, status: "submitted", transactionHash },
      { status: 202 },
    );
  } catch (error) {
    return errorResponse(error, id);
  }
}
