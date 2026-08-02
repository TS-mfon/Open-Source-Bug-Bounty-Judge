import { describe, expect, it } from "vitest";
import { errorResponse } from "./errors";

describe("errorResponse", () => {
  it("maps occupied GenLayer execution slots to a retryable 503", async () => {
    const response = errorResponse(
      new Error("Server busy: all 8 execution slots occupied, retry later"),
      "request-1",
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "GENLAYER_BUSY",
        request_id: "request-1",
        retryable: true,
      },
    });
  });

  it("maps GenLayer rate limits to a retryable 503", async () => {
    const response = errorResponse(
      new Error("Rate limit exceeded: 5000 requests per day"),
      "request-2",
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "GENLAYER_RATE_LIMITED",
        request_id: "request-2",
        retryable: true,
      },
    });
  });
});
