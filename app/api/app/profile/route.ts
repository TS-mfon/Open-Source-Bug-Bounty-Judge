import { NextResponse } from "next/server";
import { requireWalletAction } from "@/lib/app-auth";
import { ApiError, errorResponse, parseJson, requestId } from "@/lib/errors";
import {
  readRegistryNonce,
  readWalletOrganizations,
  readWalletProfile,
  registerWalletProfile,
} from "@/lib/genlayer";
import { profilePayloadSchema } from "@/lib/schemas";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const id = requestId(request);
  try {
    const wallet = new URL(request.url).searchParams.get("wallet")?.toLowerCase() ?? "";
    if (!/^0x[0-9a-f]{40}$/.test(wallet)) {
      throw new ApiError("INVALID_WALLET", "A valid wallet is required.", 422);
    }
    const [profile, nonce, organizations] = await Promise.all([
      readWalletProfile(wallet),
      readRegistryNonce(wallet),
      readWalletOrganizations(wallet),
    ]);
    return NextResponse.json({ profile, nonce, organizations });
  } catch (error) {
    return errorResponse(error, id);
  }
}

export async function POST(request: Request) {
  const id = requestId(request);
  try {
    const envelope = await requireWalletAction(await parseJson(request), "profile.register");
    const payload = profilePayloadSchema.parse(envelope.payload);
    if (await readWalletProfile(envelope.wallet)) {
      throw new ApiError("PROFILE_EXISTS", "This wallet profile already exists.", 409);
    }
    const transactionHash = await registerWalletProfile({
      wallet: envelope.wallet,
      defaultWorkspace: payload.defaultWorkspace,
      nonce: envelope.nonce,
    });
    return NextResponse.json({ status: "submitted", transactionHash }, { status: 202 });
  } catch (error) {
    return errorResponse(error, id);
  }
}
