import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { App } from "../src/app.js";
import { MemoryBroker } from "../src/broker/memory-broker.js";
import { createTestApp, tokenFor } from "./helpers/app.js";
import { createTestDatabase } from "./helpers/db.js";
import { connect, createRoom, type TestClient } from "./helpers/ws.js";

describe("two instances sharing a broker", () => {
  let first: App;
  let second: App;
  let closeDb: () => Promise<void>;
  const clients: TestClient[] = [];

  beforeAll(async () => {
    const database = await createTestDatabase();
    closeDb = database.close;
    const broker = new MemoryBroker();
    first = await createTestApp({ db: database.db, broker });
    second = await createTestApp({ db: database.db, broker });
  });

  afterAll(async () => {
    clients.forEach((c) => c.close());
    await first.close();
    await second.close();
    await closeDb();
  });

  const join = async (app: App, user: string, room: string) => {
    const client = await connect(app, await tokenFor(app, user));
    clients.push(client);
    client.send({ type: "join", room });
    await client.next("presence");
    return client;
  };

  it("delivers a message sent on one instance to a socket on the other", async () => {
    const room = await createRoom(first, await tokenFor(first, "ana"), "cluster");
    const ana = await join(first, "ana", room);
    const bea = await join(second, "bea", room);

    ana.send({ type: "message", room, text: "across", clientMsgId: "x-1" });

    const ack = await ana.next("ack");
    const delivered = await bea.next("message");
    expect(delivered.message).toMatchObject({ id: ack.id, author: "ana", text: "across" });
  });

  it("shows users from both instances in presence", async () => {
    const room = await createRoom(first, await tokenFor(first, "ana"), "cluster-presence");
    const ana = await join(first, "ana", room);
    const bea = await join(second, "bea", room);

    const seenByAna = await ana.next("presence", (p) => p.users.includes("bea"));
    const seenByBea = await bea.next("presence", (p) => p.users.includes("ana"), 500);
    expect(seenByAna.users).toEqual(["ana", "bea"]);
    expect(seenByBea.users).toEqual(["ana", "bea"]);
  });

  it("updates presence on the other instance when a socket disconnects", async () => {
    const room = await createRoom(first, await tokenFor(first, "ana"), "cluster-leave");
    const ana = await join(first, "ana", room);
    const bea = await join(second, "bea", room);
    await ana.next("presence", (p) => p.users.includes("bea"));

    bea.close();

    const presence = await ana.next("presence", (p) => !p.users.includes("bea"));
    expect(presence.users).toEqual(["ana"]);
  });
});
