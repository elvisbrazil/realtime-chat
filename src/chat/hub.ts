import type { FastifyBaseLogger } from "fastify";
import type { Broker, RoomEvent } from "../broker/broker.js";
import type { ServerEvent } from "./protocol.js";

export interface Member {
  readonly id: string;
  readonly user: string;
  readonly rooms: Set<string>;
  send(event: ServerEvent): void;
}

export class ChatHub {
  private readonly members = new Map<string, Set<Member>>();
  private readonly subscriptions = new Map<string, Promise<() => Promise<void>>>();

  constructor(
    private readonly broker: Broker,
    private readonly log: FastifyBaseLogger,
  ) {}

  async join(member: Member, room: string): Promise<void> {
    let local = this.members.get(room);
    if (!local) {
      local = new Set();
      this.members.set(room, local);
    }
    local.add(member);
    member.rooms.add(room);

    if (!this.subscriptions.has(room)) {
      this.subscriptions.set(
        room,
        this.broker.subscribe(room, (event) => this.deliver(room, event)),
      );
    }
    await this.subscriptions.get(room);
  }

  async leave(member: Member, room: string): Promise<void> {
    member.rooms.delete(room);
    const local = this.members.get(room);
    if (!local?.delete(member) || local.size > 0) return;

    this.members.delete(room);
    const subscription = this.subscriptions.get(room);
    this.subscriptions.delete(room);
    const unsubscribe = await subscription;
    await unsubscribe?.();
  }

  async leaveAll(member: Member): Promise<void> {
    await Promise.all([...member.rooms].map((room) => this.leave(member, room)));
  }

  usersIn(room: string): string[] {
    const users = new Set([...(this.members.get(room) ?? [])].map((m) => m.user));
    return [...users].sort();
  }

  publish(room: string, event: RoomEvent): Promise<void> {
    return this.broker.publish(room, event);
  }

  private deliver(room: string, event: RoomEvent): void {
    const local = this.members.get(room);
    if (!local) return;

    const outgoing = this.toServerEvent(room, event);
    for (const member of local) {
      if ("from" in event && event.from === member.id) continue;
      try {
        member.send(outgoing);
      } catch (err) {
        this.log.warn({ err, member: member.id }, "failed to deliver event");
      }
    }
  }

  private toServerEvent(room: string, event: RoomEvent): ServerEvent {
    switch (event.type) {
      case "message":
        return { type: "message", message: event.message };
      case "typing":
        return { type: "typing", room, user: event.user, isTyping: event.isTyping };
      case "presence":
        return { type: "presence", room, users: this.usersIn(room) };
    }
  }
}
