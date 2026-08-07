import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import type { Broker } from "../broker/broker.js";
import type { MessageRepository } from "../modules/messages/repository.js";
import type { RoomRepository } from "../modules/rooms/repository.js";
import { handshakeToken } from "./handshake.js";
import { TokenBucket } from "../lib/token-bucket.js";
import { ChatHub } from "./hub.js";
import { Liveness } from "./liveness.js";
import { ChatSession } from "./session.js";

interface Options {
  broker: Broker;
  rooms: RoomRepository;
  messages: MessageRepository;
  maxMessageBytes: number;
  rateLimit: { burst: number; perSecond: number };
  heartbeatMs: number;
}

export const chatRoutes: FastifyPluginAsyncZod<Options> = async (app, opts) => {
  const hub = new ChatHub(opts.broker, app.log, opts.heartbeatMs * 3);

  const liveness = new Liveness();

  const timer = setInterval(() => {
    const terminated = liveness.check();
    if (terminated > 0) app.log.info({ terminated }, "terminated unresponsive sockets");
    hub.heartbeat().catch((err: unknown) => app.log.warn({ err }, "heartbeat failed"));
  }, opts.heartbeatMs);
  timer.unref();
  app.addHook("onClose", async () => clearInterval(timer));

  app.get(
    "/ws",
    {
      websocket: true,
      schema: { querystring: z.object({ token: z.string().optional() }) },
      preValidation: async (request, reply) => {
        try {
          const token = handshakeToken(request.query, request.headers);
          request.user = app.jwt.verify<{ sub: string }>(token ?? "");
        } catch {
          return reply.code(401).send({ error: "unauthorized" });
        }
      },
    },
    (socket, request) => {
      liveness.track(socket);
      const session = new ChatSession(socket, request.user.sub, {
        hub,
        rooms: opts.rooms,
        messages: opts.messages,
        log: request.log,
        limiter: new TokenBucket(opts.rateLimit.burst, opts.rateLimit.perSecond),
      });

      socket.on("message", (data, isBinary) => {
        if (isBinary) {
          session.send({
            type: "error",
            code: "bad_request",
            message: "binary frames not supported",
          });
          return;
        }
        const raw = data.toString();
        if (Buffer.byteLength(raw) > opts.maxMessageBytes) {
          session.send({
            type: "error",
            code: "too_large",
            message: `frames are limited to ${opts.maxMessageBytes} bytes`,
          });
          return;
        }
        session.receive(raw);
      });

      socket.on("close", () => {
        session
          .close()
          .catch((err: unknown) => request.log.error({ err }, "session cleanup failed"));
      });
    },
  );
};
