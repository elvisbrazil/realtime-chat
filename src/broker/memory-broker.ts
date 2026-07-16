import type { Broker, RoomEvent, RoomEventHandler } from "./broker.js";

export class MemoryBroker implements Broker {
  private readonly handlers = new Map<string, Set<RoomEventHandler>>();

  async publish(room: string, event: RoomEvent): Promise<void> {
    const handlers = this.handlers.get(room);
    if (!handlers) return;
    const payload = JSON.stringify(event);
    queueMicrotask(() => {
      for (const handler of handlers) handler(JSON.parse(payload) as RoomEvent);
    });
  }

  async subscribe(room: string, handler: RoomEventHandler) {
    let handlers = this.handlers.get(room);
    if (!handlers) {
      handlers = new Set();
      this.handlers.set(room, handlers);
    }
    handlers.add(handler);

    return async () => {
      handlers.delete(handler);
      if (handlers.size === 0) this.handlers.delete(room);
    };
  }

  async close(): Promise<void> {
    this.handlers.clear();
  }
}
