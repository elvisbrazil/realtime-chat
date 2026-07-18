import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { App } from "../src/app.js";
import { createTestApp, tokenFor } from "./helpers/app.js";

describe("rooms routes", () => {
  let app: App;
  let auth: { authorization: string };

  beforeAll(async () => {
    app = await createTestApp();
    auth = { authorization: `Bearer ${await tokenFor(app, "ana")}` };
  });

  afterAll(async () => {
    await app.close();
  });

  it("requires a token", async () => {
    const res = await app.inject({ method: "GET", url: "/rooms" });
    expect(res.statusCode).toBe(401);
  });

  it("creates a room owned by the caller", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/rooms",
      headers: auth,
      payload: { name: "general" },
    });

    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ name: "general", createdBy: "ana" });
  });

  it("returns 409 for a duplicate name", async () => {
    await app.inject({ method: "POST", url: "/rooms", headers: auth, payload: { name: "dupe" } });
    const res = await app.inject({
      method: "POST",
      url: "/rooms",
      headers: auth,
      payload: { name: "dupe" },
    });

    expect(res.statusCode).toBe(409);
  });

  it("rejects names with spaces or uppercase", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/rooms",
      headers: auth,
      payload: { name: "Not Valid" },
    });

    expect(res.statusCode).toBe(400);
  });

  it("lists rooms sorted by name", async () => {
    await app.inject({ method: "POST", url: "/rooms", headers: auth, payload: { name: "aaa" } });
    const res = await app.inject({ method: "GET", url: "/rooms", headers: auth });

    const names = res.json<{ rooms: { name: string }[] }>().rooms.map((r) => r.name);
    expect(names).toEqual([...names].sort());
    expect(names).toContain("aaa");
  });
});
