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
        "/admin/api-keys",
        "/campaigns",
        "/campaigns/{id}",
        "/campaigns/{id}/contributions",
        "/campaigns/{id}/reviews",
        "/reviews/{id}",
        "/reviews/{id}/appeals",
        "/reviews/single",
        "/webhook-endpoints",
        "/health",
      ]),
    );
    expect(document.paths["/reviews/{id}"].get.security).toBeUndefined();
    expect(document.paths["/campaigns"].post.security).toEqual([{ ApiKey: [] }]);
    expect(document.components.schemas.CandidateResult.properties.citations).toBeDefined();
  });
});
