import { and, desc, eq, sql } from "drizzle-orm";
import type { Database } from "../../db/client.js";
import { messages, type Message } from "../../db/schema.js";
import { uuidv7 } from "../../lib/uuidv7.js";
import { encodeCursor, type Cursor } from "./cursor.js";

export interface NewMessage {
  roomId: string;
  author: string;
  body: string;
}

export interface MessagePage {
  messages: Message[];
  nextCursor: string | null;
}

export function createMessageRepository(db: Database) {
  return {
    async insert(input: NewMessage): Promise<Message> {
      const createdAt = new Date();
      const [message] = await db
        .insert(messages)
        .values({ ...input, id: uuidv7(createdAt.getTime()), createdAt })
        .returning();
      return message!;
    },

    async page(roomId: string, limit: number, cursor?: Cursor): Promise<MessagePage> {
      const before = cursor
        ? sql`(${messages.createdAt}, ${messages.id}) < (${cursor.createdAt.toISOString()}::timestamptz, ${cursor.id}::uuid)`
        : undefined;

      const rows = await db
        .select()
        .from(messages)
        .where(and(eq(messages.roomId, roomId), before))
        .orderBy(desc(messages.createdAt), desc(messages.id))
        .limit(limit + 1);

      const page = rows.slice(0, limit);
      const last = page.at(-1);
      return {
        messages: page,
        nextCursor: rows.length > limit && last ? encodeCursor(last) : null,
      };
    },
  };
}

export type MessageRepository = ReturnType<typeof createMessageRepository>;
