import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { App } from "../src/app.js";
import { createTestApp, tokenFor } from "./helpers/app.js";
import { connect, createRoom, type TestClient } from "./helpers/ws.js";

describe("chat websocket", () => {
  let app: App;
  let anaToken: string;
  let beaToken: string;
  const clients: TestClient[] = [];

  const open = async (token: string) => {
    const client = await connect(app, token);
    clients.push(client);
    return client;
  };

  beforeAll(async () => {
    app = await createTestApp();
    anaToken = await tokenFor(app, "ana");
    beaToken = await tokenFor(app, "bea");
  });

  afterAll(async () => {
    clients.forEach((c) => c.close());
    await app.close();
  });

  it("rejects a handshake without a valid token", async () => {
    await expect(app.injectWS("/ws?token=garbage")).rejects.toThrow(/401/);
    await expect(app.injectWS("/ws")).rejects.toThrow(/401/);
  });

  it("sends a presence snapshot after joining", async () => {
    const room = await createRoom(app, anaToken, "snapshot");
    const ana = await open(anaToken);

    ana.send({ type: "join", room });

    const presence = await ana.next("presence");
    expect(presence).toEqual({ type: "presence", room, users: ["ana"] });
  });

  it("acks a message with the client id and broadcasts it to others in the room", async () => {
    const room = await createRoom(app, anaToken, "broadcast");
    const ana = await open(anaToken);
    const bea = await open(beaToken);
    ana.send({ type: "join", room });
    await ana.next("presence");
    bea.send({ type: "join", room });
    await bea.next("presence");

    ana.send({ type: "message", room, text: "hello", clientMsgId: "c-1" });

    const ack = await ana.next("ack");
    expect(ack.clientMsgId).toBe("c-1");

    const delivered = await bea.next("message");
    expect(delivered.message).toMatchObject({ id: ack.id, room, author: "ana", text: "hello" });
  });

  it("does not echo the message back to the sender", async () => {
    const room = await createRoom(app, anaToken, "no-echo");
    const ana = await open(anaToken);
    ana.send({ type: "join", room });
    await ana.next("presence");

    ana.send({ type: "message", room, text: "just me", clientMsgId: "c-2" });
    await ana.next("ack");
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(ana.received("message")).toEqual([]);
  });

  it("persists messages so they show up in history", async () => {
    const room = await createRoom(app, anaToken, "persisted");
    const ana = await open(anaToken);
    ana.send({ type: "join", room });
    await ana.next("presence");

    ana.send({ type: "message", room, text: "keep me", clientMsgId: "c-3" });
    const ack = await ana.next("ack");

    const res = await app.inject({
      method: "GET",
      url: `/rooms/${room}/messages`,
      headers: { authorization: `Bearer ${anaToken}` },
    });
    expect(res.json<{ messages: { id: string }[] }>().messages[0]?.id).toBe(ack.id);
  });

  it("refuses messages to a room the socket has not joined", async () => {
    const room = await createRoom(app, anaToken, "not-joined");
    const ana = await open(anaToken);

    ana.send({ type: "message", room, text: "hi", clientMsgId: "c-4" });

    const error = await ana.next("error");
    expect(error).toMatchObject({ code: "not_joined", clientMsgId: "c-4" });
  });

  it("reports an unknown room on join", async () => {
    const ana = await open(anaToken);

    ana.send({ type: "join", room: "00000000-0000-4000-8000-000000000000" });

    expect(await ana.next("error")).toMatchObject({ code: "unknown_room" });
  });

  it("answers invalid payloads with bad_request and keeps the socket open", async () => {
    const room = await createRoom(app, anaToken, "bad-payload");
    const ana = await open(anaToken);

    ana.ws.send("not json");
    expect(await ana.next("error")).toMatchObject({ code: "bad_request" });

    ana.send({ type: "join", room });
    expect(await ana.next("presence")).toMatchObject({ users: ["ana"] });
  });

  it("stops delivering after leave", async () => {
    const room = await createRoom(app, anaToken, "leaving");
    const ana = await open(anaToken);
    const bea = await open(beaToken);
    ana.send({ type: "join", room });
    await ana.next("presence");
    bea.send({ type: "join", room });
    await bea.next("presence");
    await ana.next("presence", (p) => p.users.includes("bea"));

    bea.send({ type: "leave", room });
    await ana.next("presence", (p) => !p.users.includes("bea"));
    ana.send({ type: "message", room, text: "anyone?", clientMsgId: "c-5" });
    await ana.next("ack");
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(bea.received("message")).toEqual([]);
  });

  it("forwards typing indicators to others", async () => {
    const room = await createRoom(app, anaToken, "typing");
    const ana = await open(anaToken);
    const bea = await open(beaToken);
    ana.send({ type: "join", room });
    await ana.next("presence");
    bea.send({ type: "join", room });
    await bea.next("presence");

    ana.send({ type: "typing", room, isTyping: true });

    expect(await bea.next("typing")).toEqual({ type: "typing", room, user: "ana", isTyping: true });
  });
});
