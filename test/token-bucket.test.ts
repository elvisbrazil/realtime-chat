import { describe, expect, it } from "vitest";
import { TokenBucket } from "../src/lib/token-bucket.js";

function clock(start = 0) {
  let now = start;
  return { now: () => now, advance: (ms: number) => (now += ms) };
}

describe("TokenBucket", () => {
  it("allows a burst up to capacity", () => {
    const bucket = new TokenBucket(3, 1, clock().now);

    expect([bucket.take(), bucket.take(), bucket.take(), bucket.take()]).toEqual([
      true,
      true,
      true,
      false,
    ]);
  });

  it("refills at the configured rate", () => {
    const time = clock();
    const bucket = new TokenBucket(2, 2, time.now);
    bucket.take();
    bucket.take();

    time.advance(499);
    expect(bucket.take()).toBe(false);

    time.advance(1);
    expect(bucket.take()).toBe(true);
    expect(bucket.take()).toBe(false);
  });

  it("never holds more than capacity", () => {
    const time = clock();
    const bucket = new TokenBucket(2, 10, time.now);

    time.advance(60_000);

    expect([bucket.take(), bucket.take(), bucket.take()]).toEqual([true, true, false]);
  });

  it("ignores a clock that goes backwards", () => {
    const time = clock(10_000);
    const bucket = new TokenBucket(1, 1, time.now);
    bucket.take();

    time.advance(-5_000);
    expect(bucket.take()).toBe(false);
  });
});
