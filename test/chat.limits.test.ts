import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { App } from "../src/app.js";
import { createTestApp, tokenFor } from "./helpers/app.js";
import { connect, createRoom, type TestClient } from "./helpers/ws.js";

describe("chat limits", () => {
  let app: App;
  let token: string;
  let room: string;
  let client: TestClient;

  beforeAll(async () => {
    app = await createTestApp({
      config: { RATE_LIMIT_BURST: 3, RATE_LIMIT_PER_SECOND: 0.001, MAX_MESSAGE_BYTES: 256 },
    });
    token = await tokenFor(app, "ana");
    room = await createRoom(app, token, "limits");
    client = await connect(app, token);
    client.send({ type: "join", room });
    await client.next("presence");
  });

  afterAll(async () => {
    client.close();
    await app.close();
  });

  it("returns rate_limited once the burst is used up", async () => {
    for (let i = 1; i <= 4; i++) {
      client.send({ type: "message", room, text: `m${i}`, clientMsgId: `m${i}` });
    }

    for (let i = 1; i <= 3; i++) {
      await client.next("ack", (ack) => ack.clientMsgId === `m${i}`);
    }
    const error = await client.next("error");
    expect(error).toMatchObject({ code: "rate_limited", clientMsgId: "m4" });
  });

  it("rejects frames larger than the configured size", async () => {
    client.send({ type: "message", room, text: "x".repeat(300), clientMsgId: "big" });

    expect(await client.next("error")).toMatchObject({ code: "too_large" });
    expect(client.ws.readyState).toBe(client.ws.OPEN);
  });
});
