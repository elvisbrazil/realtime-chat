import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestApp } from "./helpers/app.js";

describe("POST /auth/token", () => {
  let app: Awaited<ReturnType<typeof createTestApp>>;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it("issues a token whose subject is the username", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/token",
      payload: { username: "ana" },
    });

    expect(res.statusCode).toBe(200);
    const { token } = res.json<{ token: string }>();
    expect(app.jwt.decode<{ sub: string }>(token)?.sub).toBe("ana");
  });

  it("rejects an invalid username", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/token",
      payload: { username: "no spaces allowed" },
    });

    expect(res.statusCode).toBe(400);
  });
});
