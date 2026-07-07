import Fastify from "fastify";
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from "fastify-type-provider-zod";
import type { Config } from "./config.js";
import type { Database } from "./db/client.js";
import { authRoutes } from "./modules/auth/routes.js";
import { createMessageRepository } from "./modules/messages/repository.js";
import { messageRoutes } from "./modules/messages/routes.js";
import { createRoomRepository } from "./modules/rooms/repository.js";
import { roomRoutes } from "./modules/rooms/routes.js";
import { authPlugin } from "./plugins/auth.js";

export type AppConfig = Pick<Config, "LOG_LEVEL" | "JWT_SECRET" | "JWT_EXPIRES_IN">;

export interface AppDeps {
  config: AppConfig;
  db: Database;
}

export function buildApp({ config, db }: AppDeps) {
  const app = Fastify({ logger: { level: config.LOG_LEVEL } }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  app.register(authPlugin, { secret: config.JWT_SECRET, expiresIn: config.JWT_EXPIRES_IN });

  app.get("/health", async () => ({ status: "ok" }));
  app.register(authRoutes);
  const rooms = createRoomRepository(db);
  const messages = createMessageRepository(db);

  app.register(roomRoutes, { rooms });
  app.register(messageRoutes, { rooms, messages });

  return app;
}

export type App = ReturnType<typeof buildApp>;
