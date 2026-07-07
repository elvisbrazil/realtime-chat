import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createMessageRepository } from "../src/modules/messages/repository.js";
import { createRoomRepository } from "../src/modules/rooms/repository.js";
import { buildApp } from "../src/app.js";
import { createTestDatabase } from "./helpers/db.js";
import { testConfig } from "./helpers/app.js";

interface Page {
  messages: { body: string }[];
  nextCursor: string | null;
}

describe("GET /rooms/:roomId/messages", () => {
  let app: ReturnType<typeof buildApp>;
  let close: () => Promise<void>;
  let roomId: string;
  let auth: { authorization: string };

  beforeAll(async () => {
    const database = await createTestDatabase();
    close = database.close;
    app = buildApp({ config: testConfig, db: database.db });
    await app.ready();
    auth = { authorization: `Bearer ${app.jwt.sign({ sub: "ana" })}` };

    const room = await createRoomRepository(database.db).create("history", "ana");
    roomId = room!.id;
    const messages = createMessageRepository(database.db);
    for (let i = 1; i <= 7; i++) {
      await messages.insert({ roomId, author: "ana", body: `msg ${i}` });
    }
  });

  afterAll(async () => {
    await app.close();
    await close();
  });

  const fetchPage = async (query: string) => {
    const res = await app.inject({
      method: "GET",
      url: `/rooms/${roomId}/messages?${query}`,
      headers: auth,
    });
    return res;
  };

  it("returns the newest messages first", async () => {
    const page = (await fetchPage("limit=3")).json<Page>();

    expect(page.messages.map((m) => m.body)).toEqual(["msg 7", "msg 6", "msg 5"]);
    expect(page.nextCursor).toEqual(expect.any(String));
  });

  it("walks the whole history with the cursor without gaps or repeats", async () => {
    const bodies: string[] = [];
    let cursor: string | null = null;
    do {
      const query: string = cursor ? `limit=3&cursor=${cursor}` : "limit=3";
      const page: Page = (await fetchPage(query)).json<Page>();
      bodies.push(...page.messages.map((m) => m.body));
      cursor = page.nextCursor;
    } while (cursor);

    expect(bodies).toEqual(["msg 7", "msg 6", "msg 5", "msg 4", "msg 3", "msg 2", "msg 1"]);
  });

  it("returns 400 for a garbage cursor", async () => {
    const res = await fetchPage("cursor=not-a-cursor");
    expect(res.statusCode).toBe(400);
  });

  it("returns 404 for an unknown room", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/rooms/00000000-0000-4000-8000-000000000000/messages",
      headers: auth,
    });
    expect(res.statusCode).toBe(404);
  });
});
