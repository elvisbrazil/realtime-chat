import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Presence } from "../src/chat/presence.js";

describe("Presence", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("reports whether a user is new to the room", () => {
    const presence = new Presence(30_000);

    expect(presence.touch("r1", "ana")).toBe(true);
    expect(presence.touch("r1", "ana")).toBe(false);
    expect(presence.touch("r2", "ana")).toBe(true);
  });

  it("lists users of a room sorted", () => {
    const presence = new Presence(30_000);
    presence.touch("r1", "caio");
    presence.touch("r1", "ana");
    presence.touch("r2", "bea");

    expect(presence.users("r1")).toEqual(["ana", "caio"]);
  });

  it("expires users that were not refreshed within the ttl", () => {
    const presence = new Presence(30_000);
    presence.touch("r1", "ana");
    presence.touch("r1", "bea");

    vi.advanceTimersByTime(20_000);
    presence.touch("r1", "bea");
    expect(presence.sweep()).toEqual([]);

    vi.advanceTimersByTime(10_000);
    expect(presence.sweep()).toEqual([{ room: "r1", user: "ana" }]);
    expect(presence.users("r1")).toEqual(["bea"]);

    vi.advanceTimersByTime(20_000);
    expect(presence.sweep()).toEqual([{ room: "r1", user: "bea" }]);
    expect(presence.users("r1")).toEqual([]);
  });

  it("remove returns false for someone who was not there", () => {
    const presence = new Presence(30_000);
    presence.touch("r1", "ana");

    expect(presence.remove("r1", "bea")).toBe(false);
    expect(presence.remove("r1", "ana")).toBe(true);
  });
});
