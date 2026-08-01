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
    expect(document.paths["/reviews/single"].post.requestBody).toBeDefined();
    expect(document.paths["/reviews/{id}/appeals"].post.requestBody).toBeDefined();
    expect(document.paths["/webhook-endpoints"].post.requestBody).toBeDefined();
    expect(document.paths["/reviews"].post.responses["422"].$ref).toBe(
      "#/components/responses/InvalidRequest",
    );
    expect(document.paths["/reviews"].post.responses["200"]).toBeDefined();
    expect(document.paths["/reviews"].post.parameters).toContainEqual({
      $ref: "#/components/parameters/PreferWait",
    });
    expect(document.paths["/reviews/{id}"].get.parameters).toContainEqual(
      expect.objectContaining({ name: "wait" }),
    );
    expect(document.components.schemas.Contribution.properties.repository.pattern).toBeDefined();
    expect(document.components.schemas.CandidateResult.properties.confidence_bps).toBeDefined();
    expect(document.components.schemas.ErrorResponse).toBeDefined();
  });
});
