import { NextResponse } from "next/server";
import { ApiError, errorResponse, requestId } from "@/lib/errors";
import {
  readMemberRole,
  readOrganizationReviews,
  readWalletReviews,
} from "@/lib/genlayer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const id = requestId(request);
  try {
    const params = new URL(request.url).searchParams;
    const wallet = params.get("wallet")?.toLowerCase() ?? "";
    const organizationId = params.get("organizationId") ?? "";
    if (organizationId) {
      const role = await readMemberRole(organizationId, wallet);
      if (!role) throw new ApiError("FORBIDDEN", "Wallet is not an organization member.", 403);
      return NextResponse.json({
        reviews: await readOrganizationReviews(organizationId),
        role,
      });
    }
    return NextResponse.json({ reviews: await readWalletReviews(wallet) });
  } catch (error) {
    return errorResponse(error, id);
  }
}
