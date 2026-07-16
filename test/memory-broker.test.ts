import { describe, expect, it, vi } from "vitest";
import type { RoomEvent } from "../src/broker/broker.js";
import { MemoryBroker } from "../src/broker/memory-broker.js";

const event: RoomEvent = { type: "presence", room: "r1", user: "ana", status: "online" };

describe("MemoryBroker", () => {
  it("delivers to every subscriber of the room", async () => {
    const broker = new MemoryBroker();
    const a = vi.fn();
    const b = vi.fn();
    await broker.subscribe("r1", a);
    await broker.subscribe("r1", b);

    await broker.publish("r1", event);

    await vi.waitFor(() => {
      expect(a).toHaveBeenCalledWith(event);
      expect(b).toHaveBeenCalledWith(event);
    });
  });

  it("does not deliver to other rooms", async () => {
    const broker = new MemoryBroker();
    const handler = vi.fn();
    await broker.subscribe("r2", handler);

    await broker.publish("r1", event);
    await new Promise((resolve) => setImmediate(resolve));

    expect(handler).not.toHaveBeenCalled();
  });

  it("stops delivering after unsubscribe", async () => {
    const broker = new MemoryBroker();
    const handler = vi.fn();
    const unsubscribe = await broker.subscribe("r1", handler);

    await unsubscribe();
    await broker.publish("r1", event);
    await new Promise((resolve) => setImmediate(resolve));

    expect(handler).not.toHaveBeenCalled();
  });
});
