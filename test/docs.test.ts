import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { App } from "../src/app.js";
import { createTestApp } from "./helpers/app.js";

describe("openapi docs", () => {
  let app: App;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it("documents the REST routes", async () => {
    const res = await app.inject({ method: "GET", url: "/docs/json" });

    expect(res.statusCode).toBe(200);
    expect(Object.keys(res.json<{ paths: object }>().paths)).toEqual(
      expect.arrayContaining(["/auth/token", "/rooms", "/rooms/{roomId}/messages"]),
    );
  });
});
