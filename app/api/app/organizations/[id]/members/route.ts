import { NextResponse } from "next/server";
import { requireWalletAction } from "@/lib/app-auth";
import { errorResponse, parseJson, requestId } from "@/lib/errors";
import {
  addOrganizationMember,
  readOrganizationMembers,
  readRegistryNonce,
  removeOrganizationMember,
  setOrganizationMemberRole,
} from "@/lib/genlayer";
import { memberPayloadSchema } from "@/lib/schemas";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const requestIdentifier = requestId(request);
  try {
    const { id } = await context.params;
    const wallet = new URL(request.url).searchParams.get("wallet") ?? "";
    const [members, nonce] = await Promise.all([
      readOrganizationMembers(id),
      readRegistryNonce(wallet),
    ]);
    return NextResponse.json({ members, nonce });
  } catch (error) {
    return errorResponse(error, requestIdentifier);
  }
}

async function mutate(
  request: Request,
  context: { params: Promise<{ id: string }> },
  action: "organization.member.add" | "organization.member.role" | "organization.member.remove",
) {
  const requestIdentifier = requestId(request);
  try {
    const { id } = await context.params;
    const envelope = await requireWalletAction(await parseJson(request), action);
    const payload = memberPayloadSchema.parse(envelope.payload);
    if (payload.organizationId !== id) throw new Error("Organization mismatch");
    const common = {
      organizationId: id,
      actorWallet: envelope.wallet,
      memberWallet: payload.memberWallet,
      nonce: envelope.nonce,
    };
    const transactionHash =
      action === "organization.member.add"
        ? await addOrganizationMember({ ...common, role: payload.role })
        : action === "organization.member.role"
          ? await setOrganizationMemberRole({ ...common, role: payload.role })
          : await removeOrganizationMember(common);
    return NextResponse.json({ status: "submitted", transactionHash }, { status: 202 });
  } catch (error) {
    return errorResponse(error, requestIdentifier);
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return mutate(request, context, "organization.member.add");
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return mutate(request, context, "organization.member.role");
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return mutate(request, context, "organization.member.remove");
}
