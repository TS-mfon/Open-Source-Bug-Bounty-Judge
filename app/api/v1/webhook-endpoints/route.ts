import { NextResponse } from "next/server";
import { requireApiKey } from "@/lib/auth";
import { ApiError, errorResponse, parseJson, requestId } from "@/lib/errors";
import { setWebhookEndpoint } from "@/lib/genlayer";
import { webhookSchema } from "@/lib/schemas";
import { assertPublicHttpsUrl } from "@/lib/url-security";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const requestIdentifier = requestId(request);
  try {
    const key = await requireApiKey(request, "webhooks:manage");
    const input = webhookSchema.parse(await parseJson(request));
    if (key.organization_id !== input.organizationId) {
      throw new ApiError("ORGANIZATION_MISMATCH", "Organization mismatch.", 403);
    }
    const endpointUrl = await assertPublicHttpsUrl(input.endpointUrl);
    const transactionHash = await setWebhookEndpoint(
      input.organizationId,
      endpointUrl,
      key.key_hash,
    );
    return NextResponse.json(
      {
        organizationId: input.organizationId,
        endpointUrl,
        status: "submitted",
        transactionHash,
      },
      { status: 202 },
    );
  } catch (error) {
    return errorResponse(error, requestIdentifier);
  }
}
