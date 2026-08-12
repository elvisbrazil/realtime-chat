import { Redis } from "ioredis";
import type { Broker, RoomEvent, RoomEventHandler } from "./broker.js";

const PREFIX = "chat:room:";

export class RedisBroker implements Broker {
  private readonly handlers = new Map<string, Set<RoomEventHandler>>();

  constructor(
    private readonly pub: Redis,
    private readonly sub: Redis,
  ) {
    sub.on("message", (channel: string, payload: string) => this.dispatch(channel, payload));
  }

  static connect(url: string): RedisBroker {
    const pub = new Redis(url);
    const sub = pub.duplicate();
    return new RedisBroker(pub, sub);
  }

  async publish(room: string, event: RoomEvent): Promise<void> {
    await this.pub.publish(PREFIX + room, JSON.stringify(event));
  }

  async subscribe(room: string, handler: RoomEventHandler) {
    let handlers = this.handlers.get(room);
    if (!handlers) {
      handlers = new Set();
      this.handlers.set(room, handlers);
      await this.sub.subscribe(PREFIX + room);
    }
    handlers.add(handler);

    return async () => {
      handlers.delete(handler);
      if (handlers.size === 0 && this.handlers.get(room) === handlers) {
        this.handlers.delete(room);
        await this.sub.unsubscribe(PREFIX + room);
      }
    };
  }

  async close(): Promise<void> {
    await Promise.all([this.pub.quit(), this.sub.quit()]);
  }

  private dispatch(channel: string, payload: string): void {
    if (!channel.startsWith(PREFIX)) return;
    const handlers = this.handlers.get(channel.slice(PREFIX.length));
    if (!handlers) return;

    let event: RoomEvent;
    try {
      event = JSON.parse(payload) as RoomEvent;
    } catch {
      return;
    }
    for (const handler of handlers) handler(event);
  }
}
