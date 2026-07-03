import { buildApp, type AppConfig } from "../../src/app.js";
import { createTestDatabase } from "./db.js";

export const testConfig: AppConfig = {
  LOG_LEVEL: "silent",
  JWT_SECRET: "test-secret-0123456789abcdef",
  JWT_EXPIRES_IN: "1h",
};

export async function createTestApp(overrides: Partial<AppConfig> = {}) {
  const database = await createTestDatabase();
  const app = buildApp({ config: { ...testConfig, ...overrides }, db: database.db });
  app.addHook("onClose", async () => {
    await database.close();
  });
  await app.ready();
  return app;
}

export async function tokenFor(app: Awaited<ReturnType<typeof createTestApp>>, username: string) {
  const res = await app.inject({ method: "POST", url: "/auth/token", payload: { username } });
  return res.json<{ token: string }>().token;
}
