import { randomUUID } from "node:crypto";
import type { FastifyBaseLogger } from "fastify";
import type { WebSocket } from "ws";
import type { TokenBucket } from "../lib/token-bucket.js";
import type { MessageRepository } from "../modules/messages/repository.js";
import type { RoomRepository } from "../modules/rooms/repository.js";
import type { ChatHub, Member } from "./hub.js";
import { parseClientMessage, type ClientMessage, type ServerEvent } from "./protocol.js";

export interface SessionDeps {
  hub: ChatHub;
  rooms: RoomRepository;
  messages: MessageRepository;
  log: FastifyBaseLogger;
  limiter: TokenBucket;
}

export class ChatSession implements Member {
  readonly id = randomUUID();
  readonly rooms = new Set<string>();
  private queue: Promise<void> = Promise.resolve();

  constructor(
    private readonly socket: WebSocket,
    readonly user: string,
    private readonly deps: SessionDeps,
  ) {}

  send(event: ServerEvent): void {
    if (this.socket.readyState === this.socket.OPEN) {
      this.socket.send(JSON.stringify(event));
    }
  }

  receive(raw: string): void {
    this.queue = this.queue
      .then(() => this.handle(raw))
      .catch((err: unknown) => {
        this.deps.log.error({ err, session: this.id }, "failed to handle client message");
        this.send({ type: "error", code: "internal", message: "something went wrong" });
      });
  }

  async close(): Promise<void> {
    await this.queue;
    const rooms = [...this.rooms];
    await this.deps.hub.leaveAll(this);
    await Promise.all(
      rooms.map((room) =>
        this.deps.hub.publish(room, { type: "presence", room, user: this.user, status: "offline" }),
      ),
    );
  }

  private async handle(raw: string): Promise<void> {
    const parsed = parseClientMessage(raw);
    if (!parsed.ok) {
      this.send({ type: "error", code: "bad_request", message: parsed.error });
      return;
    }

    const message = parsed.message;
    switch (message.type) {
      case "join":
        return this.join(message.room);
      case "leave":
        return this.leave(message.room);
      case "message":
        return this.post(message);
      case "typing":
        return this.typing(message.room, message.isTyping);
    }
  }

  private async join(room: string): Promise<void> {
    if (this.rooms.has(room)) return;
    if (!(await this.deps.rooms.findById(room))) {
      this.send({ type: "error", code: "unknown_room", message: `room ${room} does not exist` });
      return;
    }

    await this.deps.hub.join(this, room);
    await this.deps.hub.publish(room, {
      type: "presence",
      room,
      user: this.user,
      status: "online",
    });
  }

  private async leave(room: string): Promise<void> {
    if (!this.rooms.has(room)) return;
    await this.deps.hub.leave(this, room);
    await this.deps.hub.publish(room, {
      type: "presence",
      room,
      user: this.user,
      status: "offline",
    });
  }

  private async post(message: Extract<ClientMessage, { type: "message" }>): Promise<void> {
    const { room, text, clientMsgId } = message;
    if (!this.rooms.has(room)) {
      this.send({ type: "error", code: "not_joined", message: "join the room first", clientMsgId });
      return;
    }
    if (!this.deps.limiter.take()) {
      this.send({ type: "error", code: "rate_limited", message: "slow down", clientMsgId });
      return;
    }

    const saved = await this.deps.messages.insert({ roomId: room, author: this.user, body: text });
    const createdAt = saved.createdAt.toISOString();

    this.send({ type: "ack", clientMsgId, id: saved.id, createdAt });
    await this.deps.hub.publish(room, {
      type: "message",
      from: this.id,
      message: { id: saved.id, room, author: this.user, text: saved.body, createdAt },
    });
  }

  private async typing(room: string, isTyping: boolean): Promise<void> {
    if (!this.rooms.has(room)) return;
    await this.deps.hub.publish(room, {
      type: "typing",
      from: this.id,
      room,
      user: this.user,
      isTyping,
    });
  }
}
