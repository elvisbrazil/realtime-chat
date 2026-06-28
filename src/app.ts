import Fastify from "fastify";
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from "fastify-type-provider-zod";
import type { Config } from "./config.js";

export type AppConfig = Pick<Config, "LOG_LEVEL">;

export function buildApp(config: AppConfig) {
  const app = Fastify({ logger: { level: config.LOG_LEVEL } }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  app.get("/health", async () => ({ status: "ok" }));

  return app;
}

export type App = ReturnType<typeof buildApp>;
