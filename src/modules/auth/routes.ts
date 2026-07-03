import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";

export const usernameSchema = z
  .string()
  .regex(/^[a-zA-Z0-9_.-]{2,32}$/, "2-32 chars: letters, digits, dot, dash or underscore");

export const authRoutes: FastifyPluginAsyncZod = async (app) => {
  app.post(
    "/auth/token",
    {
      schema: {
        body: z.object({ username: usernameSchema }),
        response: { 200: z.object({ token: z.string() }) },
      },
    },
    async (request) => {
      const token = app.jwt.sign({ sub: request.body.username });
      return { token };
    },
  );
};
