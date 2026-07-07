import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import type { Message } from "../../db/schema.js";
import type { RoomRepository } from "../rooms/repository.js";
import { decodeCursor } from "./cursor.js";
import type { MessageRepository } from "./repository.js";

export const messageSchema = z.object({
  id: z.uuid(),
  roomId: z.uuid(),
  author: z.string(),
  body: z.string(),
  createdAt: z.iso.datetime(),
});

export const toMessageDto = (message: Message) => ({
  ...message,
  createdAt: message.createdAt.toISOString(),
});

interface Options {
  rooms: RoomRepository;
  messages: MessageRepository;
}

export const messageRoutes: FastifyPluginAsyncZod<Options> = async (app, opts) => {
  app.addHook("onRequest", app.authenticate);

  app.get(
    "/rooms/:roomId/messages",
    {
      schema: {
        params: z.object({ roomId: z.uuid() }),
        querystring: z.object({
          limit: z.coerce.number().int().min(1).max(100).default(50),
          cursor: z.string().optional(),
        }),
        response: {
          200: z.object({ messages: z.array(messageSchema), nextCursor: z.string().nullable() }),
          400: z.object({ error: z.string() }),
          404: z.object({ error: z.string() }),
        },
      },
    },
    async (request, reply) => {
      const { roomId } = request.params;
      const { limit, cursor: rawCursor } = request.query;

      const cursor = rawCursor ? decodeCursor(rawCursor) : undefined;
      if (cursor === null) {
        return reply.code(400).send({ error: "invalid cursor" });
      }

      if (!(await opts.rooms.findById(roomId))) {
        return reply.code(404).send({ error: "room not found" });
      }

      const page = await opts.messages.page(roomId, limit, cursor);
      return { messages: page.messages.map(toMessageDto), nextCursor: page.nextCursor };
    },
  );
};
