import { buildApp } from "./app.js";
import type { Broker } from "./broker/broker.js";
import { MemoryBroker } from "./broker/memory-broker.js";
import { RedisBroker } from "./broker/redis-broker.js";
import { loadConfig } from "./config.js";
import { createDatabase } from "./db/client.js";

const config = loadConfig();
const database = createDatabase(config.DATABASE_URL);
const broker: Broker = config.REDIS_URL
  ? RedisBroker.connect(config.REDIS_URL)
  : new MemoryBroker();
const app = buildApp({ config, db: database.db, broker });

app.log.info({ broker: config.REDIS_URL ? "redis" : "memory" }, "broker ready");

const shutdown = async (signal: string) => {
  app.log.info({ signal }, "shutting down");
  try {
    await app.close();
    await broker.close();
    await database.close();
    process.exit(0);
  } catch (err) {
    app.log.error(err, "error during shutdown");
    process.exit(1);
  }
};

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));

await app.listen({ host: config.HOST, port: config.PORT });
