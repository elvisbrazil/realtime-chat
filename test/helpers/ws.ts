import type { WebSocket } from "ws";
import type { App } from "../../src/app.js";
import type { ServerEvent } from "../../src/chat/protocol.js";

type Predicate = (event: ServerEvent) => boolean;

export class TestClient {
  private readonly buffer: ServerEvent[] = [];
  private readonly waiters: { predicate: Predicate; resolve: (event: ServerEvent) => void }[] = [];

  constructor(readonly ws: WebSocket) {
    ws.on("message", (data) => {
      const event = JSON.parse(data.toString()) as ServerEvent;
      const index = this.waiters.findIndex((w) => w.predicate(event));
      if (index >= 0) {
        this.waiters.splice(index, 1)[0]!.resolve(event);
      } else {
        this.buffer.push(event);
      }
    });
  }

  send(message: unknown): void {
    this.ws.send(JSON.stringify(message));
  }

  next<T extends ServerEvent["type"]>(
    type: T,
    match: (event: Extract<ServerEvent, { type: T }>) => boolean = () => true,
    timeoutMs = 2000,
  ): Promise<Extract<ServerEvent, { type: T }>> {
    const predicate = (event: ServerEvent) =>
      event.type === type && match(event as Extract<ServerEvent, { type: T }>);

    const index = this.buffer.findIndex(predicate);
    if (index >= 0) {
      return Promise.resolve(this.buffer.splice(index, 1)[0] as Extract<ServerEvent, { type: T }>);
    }

    return new Promise((resolve, reject) => {
      const waiter = {
        predicate,
        resolve: (event: ServerEvent) => {
          clearTimeout(timer);
          resolve(event as Extract<ServerEvent, { type: T }>);
        },
      };
      const timer = setTimeout(() => {
        this.waiters.splice(this.waiters.indexOf(waiter), 1);
        reject(new Error(`timed out waiting for "${type}"`));
      }, timeoutMs);
      this.waiters.push(waiter);
    });
  }

  received(type: ServerEvent["type"]): ServerEvent[] {
    return this.buffer.filter((event) => event.type === type);
  }

  close(): void {
    this.ws.terminate();
  }
}

export async function connect(app: App, token: string): Promise<TestClient> {
  let client: TestClient | undefined;
  await app.injectWS(`/ws?token=${token}`, {}, { onInit: (ws) => (client = new TestClient(ws)) });
  return client!;
}

export async function createRoom(app: App, token: string, name: string): Promise<string> {
  const res = await app.inject({
    method: "POST",
    url: "/rooms",
    headers: { authorization: `Bearer ${token}` },
    payload: { name },
  });
  return res.json<{ id: string }>().id;
}
