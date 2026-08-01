import { NextResponse } from "next/server";
import { errorResponse, parseJson, requestId } from "@/lib/errors";
import { resolvePullRequestHead } from "@/lib/github";
import { individualReviewIntentSchema } from "@/lib/schemas";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const id = requestId(request);
  try {
    const input = individualReviewIntentSchema.parse(await parseJson(request));
    return NextResponse.json({
      ...input,
      ...(await resolvePullRequestHead(input.repository, input.pullRequestNumber)),
    });
  } catch (error) {
    return errorResponse(error, id);
  }
}
