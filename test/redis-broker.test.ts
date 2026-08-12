import { EventEmitter } from "node:events";
import type { Redis } from "ioredis";
import { describe, expect, it, vi } from "vitest";
import type { RoomEvent } from "../src/broker/broker.js";
import { RedisBroker } from "../src/broker/redis-broker.js";

class FakeRedisServer {
  readonly subscribers = new Set<FakeSubscriber>();

  publish(channel: string, payload: string) {
    for (const sub of this.subscribers) {
      if (sub.channels.has(channel)) queueMicrotask(() => sub.emit("message", channel, payload));
    }
  }
}

class FakeSubscriber extends EventEmitter {
  readonly channels = new Set<string>();

  constructor(server: FakeRedisServer) {
    super();
    server.subscribers.add(this);
  }

  subscribe = vi.fn(async (channel: string) => {
    this.channels.add(channel);
  });

  unsubscribe = vi.fn(async (channel: string) => {
    this.channels.delete(channel);
  });

  quit = vi.fn(async () => "OK");
}

function brokerOn(server: FakeRedisServer) {
  const pub = { publish: async (c: string, p: string) => server.publish(c, p), quit: vi.fn() };
  const sub = new FakeSubscriber(server);
  const broker = new RedisBroker(pub as unknown as Redis, sub as unknown as Redis);
  return { broker, sub };
}

const event: RoomEvent = { type: "presence", room: "r1", user: "ana", status: "online" };

describe("RedisBroker", () => {
  it("delivers events published by another instance", async () => {
    const server = new FakeRedisServer();
    const a = brokerOn(server);
    const b = brokerOn(server);
    const handler = vi.fn();
    await b.broker.subscribe("r1", handler);

    await a.broker.publish("r1", event);

    await vi.waitFor(() => expect(handler).toHaveBeenCalledWith(event));
  });

  it("subscribes to a channel once per room and unsubscribes with the last handler", async () => {
    const server = new FakeRedisServer();
    const { broker, sub } = brokerOn(server);

    const off1 = await broker.subscribe("r1", vi.fn());
    const off2 = await broker.subscribe("r1", vi.fn());
    expect(sub.subscribe).toHaveBeenCalledExactlyOnceWith("chat:room:r1");

    await off1();
    expect(sub.unsubscribe).not.toHaveBeenCalled();
    await off2();
    expect(sub.unsubscribe).toHaveBeenCalledWith("chat:room:r1");
  });

  it("ignores payloads that are not JSON", async () => {
    const server = new FakeRedisServer();
    const { broker, sub } = brokerOn(server);
    const handler = vi.fn();
    await broker.subscribe("r1", handler);

    sub.emit("message", "chat:room:r1", "{oops");

    expect(handler).not.toHaveBeenCalled();
  });
});
