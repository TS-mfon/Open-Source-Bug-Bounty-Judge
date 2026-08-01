import { describe, expect, it } from "vitest";
import { GET } from "./route";

describe("OpenAPI document", () => {
  it("describes the complete public integration surface", async () => {
    const response = await GET(new Request("https://judge.example/api/v1/openapi"));
    const document = await response.json();

    expect(document.openapi).toBe("3.1.0");
    expect(document.servers[0].url).toBe("https://judge.example/api/v1");
    expect(Object.keys(document.paths)).toEqual(
      expect.arrayContaining([
        "/reviews",
        "/reviews/{id}",
        "/reviews/{id}/appeals",
        "/reviews/single",
        "/campaign",
        "/webhook-endpoints",
        "/health",
      ]),
    );
    expect(document.paths["/reviews/{id}"].get.security).toEqual([]);
    expect(document.paths["/reviews"].post).toBeDefined();
    expect(document.paths["/campaigns"]).toBeUndefined();
    expect(document.components.schemas.CandidateResult.properties.citations).toBeDefined();
  });
});
