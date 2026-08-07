import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";
import type { WebSocket } from "ws";
import { Liveness } from "../src/chat/liveness.js";

function fakeSocket() {
  const socket = new EventEmitter() as EventEmitter & { ping: () => void; terminate: () => void };
  socket.ping = vi.fn();
  socket.terminate = vi.fn();
  return socket as unknown as WebSocket & { ping: ReturnType<typeof vi.fn> };
}

describe("Liveness", () => {
  it("pings sockets on each check", () => {
    const liveness = new Liveness();
    const socket = fakeSocket();
    liveness.track(socket);

    liveness.check();

    expect(socket.ping).toHaveBeenCalledOnce();
  });

  it("terminates a socket that did not answer the previous ping", () => {
    const liveness = new Liveness();
    const socket = fakeSocket();
    liveness.track(socket);

    liveness.check();
    expect(liveness.check()).toBe(1);

    expect(socket.terminate).toHaveBeenCalledOnce();
  });

  it("keeps sockets that answer with a pong", () => {
    const liveness = new Liveness();
    const socket = fakeSocket();
    liveness.track(socket);

    for (let i = 0; i < 3; i++) {
      liveness.check();
      socket.emit("pong");
    }

    expect(socket.terminate).not.toHaveBeenCalled();
  });

  it("forgets closed sockets", () => {
    const liveness = new Liveness();
    const socket = fakeSocket();
    liveness.track(socket);

    socket.emit("close");
    liveness.check();

    expect(socket.ping).not.toHaveBeenCalled();
  });
});
