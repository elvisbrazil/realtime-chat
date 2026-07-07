import { describe, expect, it } from "vitest";
import { uuidv7 } from "../src/lib/uuidv7.js";

describe("uuidv7", () => {
  it("produces a version 7 uuid", () => {
    expect(uuidv7()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it("sorts in generation order within the same millisecond", () => {
    const ms = Date.now() + 60_000;
    const ids = Array.from({ length: 50 }, () => uuidv7(ms));
    expect([...ids].sort()).toEqual(ids);
  });

  it("encodes the timestamp in the first 48 bits", () => {
    const ms = Date.UTC(2026, 6, 4, 12, 0, 0);
    const id = uuidv7(ms + 120_000);
    expect(parseInt(id.replace(/-/g, "").slice(0, 12), 16)).toBe(ms + 120_000);
  });
});
