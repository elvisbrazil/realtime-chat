import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.js";

describe("loadConfig", () => {
  it("applies defaults", () => {
    const config = loadConfig({});
    expect(config.PORT).toBe(3000);
    expect(config.LOG_LEVEL).toBe("info");
  });

  it("coerces the port from a string", () => {
    expect(loadConfig({ PORT: "4100" }).PORT).toBe(4100);
  });

  it("throws on an invalid value", () => {
    expect(() => loadConfig({ PORT: "abc" })).toThrow(/Invalid environment/);
  });
});
