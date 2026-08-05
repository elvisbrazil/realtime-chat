import { buildApp, type App, type AppConfig } from "../../src/app.js";
import type { Broker } from "../../src/broker/broker.js";
import { MemoryBroker } from "../../src/broker/memory-broker.js";
import type { Database } from "../../src/db/client.js";
import { createTestDatabase } from "./db.js";

export const testConfig: AppConfig = {
  LOG_LEVEL: "silent",
  JWT_SECRET: "test-secret-0123456789abcdef",
  JWT_EXPIRES_IN: "1h",
  MAX_MESSAGE_BYTES: 4096,
  RATE_LIMIT_BURST: 20,
  RATE_LIMIT_PER_SECOND: 10,
  HEARTBEAT_INTERVAL_MS: 15_000,
};

interface TestAppOptions {
  config?: Partial<AppConfig>;
  db?: Database;
  broker?: Broker;
}

export async function createTestApp(options: TestAppOptions = {}): Promise<App> {
  const owned = options.db ? undefined : await createTestDatabase();
  const app = buildApp({
    config: { ...testConfig, ...options.config },
    db: options.db ?? owned!.db,
    broker: options.broker ?? new MemoryBroker(),
  });
  if (owned) {
    app.addHook("onClose", owned.close);
  }
  await app.ready();
  return app;
}

export async function tokenFor(app: App, username: string) {
  const res = await app.inject({ method: "POST", url: "/auth/token", payload: { username } });
  return res.json<{ token: string }>().token;
}
