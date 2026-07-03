import fastifyJwt from "@fastify/jwt";
import type { FastifyReply, FastifyRequest } from "fastify";
import fp from "fastify-plugin";

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: { sub: string };
    user: { sub: string };
  }
}

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

export interface AuthOptions {
  secret: string;
  expiresIn: string;
}

export const authPlugin = fp<AuthOptions>(
  async (app, opts) => {
    await app.register(fastifyJwt, {
      secret: opts.secret,
      sign: { expiresIn: opts.expiresIn },
    });

    app.decorate("authenticate", async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        await request.jwtVerify();
      } catch {
        await reply.code(401).send({ error: "unauthorized" });
      }
    });
  },
  { name: "auth" },
);
