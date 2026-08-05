import type { FastifyBaseLogger } from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryBroker } from "../src/broker/memory-broker.js";
import { ChatHub, type Member } from "../src/chat/hub.js";
import type { ServerEvent } from "../src/chat/protocol.js";

const log = { warn: vi.fn() } as unknown as FastifyBaseLogger;
const TTL = 30_000;

function member(id: string, user: string) {
  const events: ServerEvent[] = [];
  const m: Member & { events: ServerEvent[]; lastPresence(): string[] | undefined } = {
    id,
    user,
    rooms: new Set(),
    events,
    send: (event) => events.push(event),
    lastPresence: () => events.findLast((e) => e.type === "presence")?.users,
  };
  return m;
}

describe("ChatHub presence", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shares presence between hubs on the same broker", async () => {
    const broker = new MemoryBroker();
    const a = new ChatHub(broker, log, TTL);
    const b = new ChatHub(broker, log, TTL);
    const ana = member("1", "ana");
    const bea = member("2", "bea");

    await a.join(ana, "r1");
    await b.join(bea, "r1");

    await vi.waitFor(() => expect(ana.lastPresence()).toEqual(["ana", "bea"]));
  });

  it("drops users whose instance stopped heartbeating", async () => {
    const broker = new MemoryBroker();
    const dead = new ChatHub(broker, log, TTL);
    const alive = new ChatHub(broker, log, TTL);
    const bea = member("2", "bea");
    await alive.join(bea, "r1");
    await dead.join(member("1", "ana"), "r1");
    await vi.waitFor(() => expect(bea.lastPresence()).toEqual(["ana", "bea"]));

    vi.advanceTimersByTime(TTL / 3);
    await alive.heartbeat();
    vi.advanceTimersByTime(TTL / 3);
    await alive.heartbeat();
    expect(bea.lastPresence()).toEqual(["ana", "bea"]);

    vi.advanceTimersByTime(TTL / 3);
    await alive.heartbeat();
    expect(bea.lastPresence()).toEqual(["bea"]);
  });

  it("keeps a user online while one of their sockets is still in the room", async () => {
    const broker = new MemoryBroker();
    const hub = new ChatHub(broker, log, TTL);
    const tab1 = member("1", "ana");
    const tab2 = member("2", "ana");
    const bea = member("3", "bea");
    await hub.join(bea, "r1");
    await hub.join(tab1, "r1");
    await hub.join(tab2, "r1");

    await hub.leave(tab1, "r1");

    expect(bea.lastPresence()).toEqual(["ana", "bea"]);
    await hub.leave(tab2, "r1");
    expect(bea.lastPresence()).toEqual(["bea"]);
  });
});
