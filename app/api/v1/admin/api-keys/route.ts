import { NextResponse } from "next/server";
import { apiKeySchema } from "@/lib/schemas";
import { errorResponse, parseJson, requestId } from "@/lib/errors";
import { generateApiKey, sha256 } from "@/lib/hash";
import { registerOrganizationAndKey } from "@/lib/genlayer";
import { getServerConfig } from "@/lib/config";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const id = requestId(request);
  try {
    if (
      !getServerConfig().adminSecret ||
      request.headers.get("x-admin-secret") !== getServerConfig().adminSecret
    ) {
      return NextResponse.json(
        {
          error: {
            code: "UNAUTHORIZED",
            message: "Administrator authentication failed.",
            request_id: id,
            retryable: false,
          },
        },
        { status: 401 },
      );
    }
    const parsed = apiKeySchema.parse(await parseJson(request));
    const apiKey = generateApiKey();
    const transactionHash = await registerOrganizationAndKey({
      ...parsed,
      keyHash: sha256(apiKey),
    });
    return NextResponse.json(
      {
        organizationId: parsed.organizationId,
        apiKey,
        scopes: parsed.scopes,
        transactionHash,
        warning: "This API key is shown once. Store it securely.",
      },
      { status: 202 },
    );
  } catch (error) {
    return errorResponse(error, id);
  }
}
