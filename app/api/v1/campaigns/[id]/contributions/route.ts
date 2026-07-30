import { NextResponse } from "next/server";
import { requireApiKey } from "@/lib/auth";
import {
  errorResponse,
  parseJson,
  requestId,
  requireIdempotencyKey,
} from "@/lib/errors";
import { contributionsSchema } from "@/lib/schemas";
import { addContributions } from "@/lib/genlayer";
import { preflightContribution } from "@/lib/github";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const requestIdentifier = requestId(request);
  try {
    const key = await requireApiKey(request, "campaigns:write");
    const idempotencyKey = requireIdempotencyKey(request);
    const { id } = await context.params;
    const input = contributionsSchema.parse(await parseJson(request));
    if (key.organization_id !== input.organizationId) {
      return NextResponse.json(
        {
          error: {
            code: "ORGANIZATION_MISMATCH",
            message: "The API key cannot modify this organization.",
            request_id: requestIdentifier,
            retryable: false,
          },
        },
        { status: 403 },
      );
    }
    await Promise.all(input.contributions.map(preflightContribution));
    const transactionHash = await addContributions(
      id,
      input.organizationId,
      input.contributions,
      key.key_hash,
      idempotencyKey,
    );
    return NextResponse.json(
      {
        campaignId: id,
        accepted: input.contributions.length,
        status: "submitted",
        transactionHash,
      },
      { status: 202 },
    );
  } catch (error) {
    return errorResponse(error, requestIdentifier);
  }
}
