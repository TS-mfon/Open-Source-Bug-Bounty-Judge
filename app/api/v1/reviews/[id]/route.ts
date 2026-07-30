import { NextResponse } from "next/server";
import { errorResponse, requestId } from "@/lib/errors";
import { readReview, readTransaction } from "@/lib/genlayer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const requestIdentifier = requestId(request);
  try {
    const { id } = await context.params;
    const review = await readReview(id);
    if (review) {
      return NextResponse.json({ status: review.status, review });
    }
    const hash = new URL(request.url).searchParams.get("transactionHash");
    if (!hash || !/^0x[0-9a-fA-F]{64}$/.test(hash)) {
      return NextResponse.json({ status: "pending" }, { status: 202 });
    }
    return NextResponse.json(
      { status: "submitted", transaction: await readTransaction(hash as `0x${string}`) },
      { status: 202 },
    );
  } catch (error) {
    return errorResponse(error, requestIdentifier);
  }
}
