import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.js";

const base = {
  DATABASE_URL: "postgres://chat:chat@localhost:5432/chat",
  JWT_SECRET: "a-test-secret-that-is-long-enough",
};

describe("loadConfig", () => {
  it("applies defaults", () => {
    const config = loadConfig(base);
    expect(config.PORT).toBe(3000);
    expect(config.LOG_LEVEL).toBe("info");
  });

  it("coerces the port from a string", () => {
    expect(loadConfig({ ...base, PORT: "4100" }).PORT).toBe(4100);
  });

  it("requires a database url", () => {
    expect(() => loadConfig({})).toThrow(/DATABASE_URL/);
  });

  it("throws on an invalid value", () => {
    expect(() => loadConfig({ ...base, PORT: "abc" })).toThrow(/Invalid environment/);
  });
});
