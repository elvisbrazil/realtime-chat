import type { FastifyBaseLogger } from "fastify";
import type { Broker, RoomEvent } from "../broker/broker.js";
import { Presence } from "./presence.js";
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
  private readonly presence: Presence;

  constructor(
    private readonly broker: Broker,
    private readonly log: FastifyBaseLogger,
    presenceTtlMs: number,
  ) {
    this.presence = new Presence(presenceTtlMs);
  }

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

    const isNew = this.presence.touch(room, member.user);
    member.send(this.snapshot(room));
    if (isNew) this.broadcast(room, this.snapshot(room), member.id);
    await this.announce(room, member.user);
  }

  async leave(member: Member, room: string): Promise<void> {
    member.rooms.delete(room);
    const local = this.members.get(room);
    if (!local?.delete(member)) return;

    if (!this.hasLocalUser(room, member.user) && this.presence.remove(room, member.user)) {
      this.broadcast(room, this.snapshot(room));
      await this.broker.publish(room, {
        type: "presence",
        room,
        user: member.user,
        status: "offline",
      });
    }

    if (local.size > 0) return;
    this.members.delete(room);
    const subscription = this.subscriptions.get(room);
    this.subscriptions.delete(room);
    const unsubscribe = await subscription;
    await unsubscribe?.();
  }

  async leaveAll(member: Member): Promise<void> {
    await Promise.all([...member.rooms].map((room) => this.leave(member, room)));
  }

  publish(room: string, event: RoomEvent): Promise<void> {
    return this.broker.publish(room, event);
  }

  async heartbeat(): Promise<void> {
    const announcements: Promise<void>[] = [];
    for (const room of this.members.keys()) {
      for (const user of this.localUsers(room)) {
        this.presence.touch(room, user);
        announcements.push(this.announce(room, user));
      }
    }

    const expiredRooms = new Set(this.presence.sweep().map((entry) => entry.room));
    for (const room of expiredRooms) this.broadcast(room, this.snapshot(room));

    await Promise.all(announcements);
  }

  private deliver(room: string, event: RoomEvent): void {
    switch (event.type) {
      case "message":
        this.broadcast(room, { type: "message", message: event.message }, event.from);
        return;
      case "typing":
        this.broadcast(
          room,
          { type: "typing", room, user: event.user, isTyping: event.isTyping },
          event.from,
        );
        return;
      case "presence":
        this.onPresence(room, event.user, event.status);
        return;
    }
  }

  private onPresence(room: string, user: string, status: "online" | "offline"): void {
    if (status === "online") {
      if (!this.presence.touch(room, user)) return;
      this.broadcast(room, this.snapshot(room));
      for (const local of this.localUsers(room)) {
        if (local !== user) this.reannounce(room, local);
      }
      return;
    }

    if (this.hasLocalUser(room, user)) {
      this.reannounce(room, user);
      return;
    }
    if (this.presence.remove(room, user)) this.broadcast(room, this.snapshot(room));
  }

  private announce(room: string, user: string): Promise<void> {
    return this.broker.publish(room, { type: "presence", room, user, status: "online" });
  }

  private reannounce(room: string, user: string): void {
    this.announce(room, user).catch((err: unknown) =>
      this.log.warn({ err, room }, "failed to announce presence"),
    );
  }

  private localUsers(room: string): Set<string> {
    return new Set([...(this.members.get(room) ?? [])].map((member) => member.user));
  }

  private hasLocalUser(room: string, user: string): boolean {
    return this.localUsers(room).has(user);
  }

  private snapshot(room: string): ServerEvent {
    return { type: "presence", room, users: this.presence.users(room) };
  }

  private broadcast(room: string, event: ServerEvent, exceptId?: string): void {
    for (const member of this.members.get(room) ?? []) {
      if (member.id === exceptId) continue;
      try {
        member.send(event);
      } catch (err) {
        this.log.warn({ err, member: member.id }, "failed to deliver event");
      }
    }
  }
}
