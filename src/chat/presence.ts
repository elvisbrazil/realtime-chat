export interface PresenceEntry {
  room: string;
  user: string;
}

export class Presence {
  private readonly rooms = new Map<string, Map<string, number>>();

  constructor(private readonly ttlMs: number) {}

  touch(room: string, user: string): boolean {
    let users = this.rooms.get(room);
    if (!users) {
      users = new Map();
      this.rooms.set(room, users);
    }
    const isNew = !users.has(user);
    users.set(user, Date.now() + this.ttlMs);
    return isNew;
  }

  remove(room: string, user: string): boolean {
    const users = this.rooms.get(room);
    if (!users?.delete(user)) return false;
    if (users.size === 0) this.rooms.delete(room);
    return true;
  }

  users(room: string): string[] {
    return [...(this.rooms.get(room)?.keys() ?? [])].sort();
  }

  sweep(): PresenceEntry[] {
    const now = Date.now();
    const expired: PresenceEntry[] = [];
    for (const [room, users] of this.rooms) {
      for (const [user, expiresAt] of users) {
        if (expiresAt <= now) expired.push({ room, user });
      }
    }
    for (const { room, user } of expired) this.remove(room, user);
    return expired;
  }
}
