import { NextResponse } from "next/server";
import { requireWalletAction } from "@/lib/app-auth";
import { errorResponse, parseJson, requestId } from "@/lib/errors";
import {
  createOrganization,
  readRegistryNonce,
  readWalletOrganizations,
} from "@/lib/genlayer";
import { organizationPayloadSchema } from "@/lib/schemas";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const id = requestId(request);
  try {
    const wallet = new URL(request.url).searchParams.get("wallet") ?? "";
    const [organizations, nonce] = await Promise.all([
      readWalletOrganizations(wallet),
      readRegistryNonce(wallet),
    ]);
    return NextResponse.json({ organizations, nonce });
  } catch (error) {
    return errorResponse(error, id);
  }
}

export async function POST(request: Request) {
  const id = requestId(request);
  try {
    const envelope = await requireWalletAction(
      await parseJson(request),
      "organization.create",
    );
    const payload = organizationPayloadSchema.parse(envelope.payload);
    const transactionHash = await createOrganization({
      organizationId: payload.id,
      name: payload.name,
      creatorWallet: envelope.wallet,
      nonce: envelope.nonce,
    });
    return NextResponse.json(
      { organizationId: payload.id, status: "submitted", transactionHash },
      { status: 202 },
    );
  } catch (error) {
    return errorResponse(error, id);
  }
}
