import { NextResponse } from "next/server";
import { createHmac } from "node:crypto";
import { getServerConfig } from "@/lib/config";
import {
  isWebhookDelivered,
  markWebhookDelivered,
  readReview,
  readReviewCount,
  readReviewIdAt,
  readWebhookEndpoint,
} from "@/lib/genlayer";
import { sha256 } from "@/lib/hash";
import { assertPublicHttpsUrl } from "@/lib/url-security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const config = getServerConfig();
  if (!config.cronSecret || request.headers.get("authorization") !== `Bearer ${config.cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const total = await readReviewCount();
  const start = Math.max(0, total - 20);
  const deliveries: Array<Record<string, unknown>> = [];
  for (let index = start; index < total; index += 1) {
    const reviewId = await readReviewIdAt(index);
    if (!reviewId) continue;
    const review = await readReview(reviewId);
    if (!review || review.organization_id === "individual") continue;
    const endpoint = await readWebhookEndpoint(review.organization_id);
    if (!endpoint) continue;
    const deliveryKey = sha256(
      `${reviewId}|review.${review.status}|${endpoint}`,
    );
    if (await isWebhookDelivered(deliveryKey)) continue;
    const timestamp = String(Math.floor(Date.now() / 1000));
    const body = JSON.stringify({
      id: deliveryKey,
      type: `review.${review.status}`,
      createdAt: new Date().toISOString(),
      data: { reviewId, review },
    });
    const signature = createHmac("sha256", config.webhookSecret)
      .update(`${timestamp}.${body}`)
      .digest("hex");
    try {
      const verifiedEndpoint = await assertPublicHttpsUrl(endpoint);
      const response = await fetch(verifiedEndpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-osj-delivery-id": deliveryKey,
          "x-osj-timestamp": timestamp,
          "x-osj-signature": `v1=${signature}`,
        },
        body,
        signal: AbortSignal.timeout(10_000),
      });
      if (response.ok) {
        const markTransactionHash = await markWebhookDelivered(deliveryKey);
        deliveries.push({
          reviewId,
          endpoint,
          delivered: true,
          markTransactionHash,
        });
      } else {
        deliveries.push({
          reviewId,
          endpoint,
          delivered: false,
          status: response.status,
        });
      }
    } catch (error) {
      deliveries.push({
        reviewId,
        endpoint,
        delivered: false,
        error: error instanceof Error ? error.message : "Webhook request failed",
      });
    }
  }
  return NextResponse.json({ ok: true, scanned: total - start, deliveries });
}
