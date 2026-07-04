import { asc, eq } from "drizzle-orm";
import type { Database } from "../../db/client.js";
import { rooms, type Room } from "../../db/schema.js";

export function createRoomRepository(db: Database) {
  return {
    async create(name: string, createdBy: string): Promise<Room | undefined> {
      const [room] = await db
        .insert(rooms)
        .values({ name, createdBy })
        .onConflictDoNothing({ target: rooms.name })
        .returning();
      return room;
    },

    async list(): Promise<Room[]> {
      return db.select().from(rooms).orderBy(asc(rooms.name));
    },

    async findById(id: string): Promise<Room | undefined> {
      const [room] = await db.select().from(rooms).where(eq(rooms.id, id));
      return room;
    },
  };
}

export type RoomRepository = ReturnType<typeof createRoomRepository>;
