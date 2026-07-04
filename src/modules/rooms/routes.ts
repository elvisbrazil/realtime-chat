import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import type { Room } from "../../db/schema.js";
import type { RoomRepository } from "./repository.js";

const roomSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  createdBy: z.string(),
  createdAt: z.iso.datetime(),
});

const toDto = (room: Room) => ({ ...room, createdAt: room.createdAt.toISOString() });

export const roomRoutes: FastifyPluginAsyncZod<{ rooms: RoomRepository }> = async (app, opts) => {
  app.addHook("onRequest", app.authenticate);

  app.post(
    "/rooms",
    {
      schema: {
        body: z.object({
          name: z
            .string()
            .trim()
            .regex(/^[a-z0-9-]{2,40}$/, "lowercase letters, digits and dashes"),
        }),
        response: { 201: roomSchema, 409: z.object({ error: z.string() }) },
      },
    },
    async (request, reply) => {
      const room = await opts.rooms.create(request.body.name, request.user.sub);
      if (!room) {
        return reply.code(409).send({ error: "room already exists" });
      }
      return reply.code(201).send(toDto(room));
    },
  );

  app.get(
    "/rooms",
    { schema: { response: { 200: z.object({ rooms: z.array(roomSchema) }) } } },
    async () => {
      const rooms = await opts.rooms.list();
      return { rooms: rooms.map(toDto) };
    },
  );
};
