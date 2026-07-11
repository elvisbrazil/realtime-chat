import { describe, expect, it } from "vitest";
import { parseClientMessage } from "../src/chat/protocol.js";

const room = "0198a1b2-0000-7000-8000-000000000001";

describe("parseClientMessage", () => {
  it("parses a join", () => {
    expect(parseClientMessage(JSON.stringify({ type: "join", room }))).toEqual({
      ok: true,
      message: { type: "join", room },
    });
  });

  it("trims message text", () => {
    const result = parseClientMessage(
      JSON.stringify({ type: "message", room, text: "  hi  ", clientMsgId: "c1" }),
    );
    expect(result).toEqual({
      ok: true,
      message: { type: "message", room, text: "hi", clientMsgId: "c1" },
    });
  });

  it("parses typing", () => {
    const result = parseClientMessage(JSON.stringify({ type: "typing", room, isTyping: true }));
    expect(result.ok).toBe(true);
  });

  it("rejects malformed JSON", () => {
    expect(parseClientMessage("{nope")).toEqual({ ok: false, error: "invalid JSON" });
  });

  it("rejects an unknown type", () => {
    expect(parseClientMessage(JSON.stringify({ type: "shout", room })).ok).toBe(false);
  });

  it("rejects a message without clientMsgId", () => {
    const result = parseClientMessage(JSON.stringify({ type: "message", room, text: "hi" }));
    expect(result.ok).toBe(false);
  });

  it("rejects whitespace-only text", () => {
    const result = parseClientMessage(
      JSON.stringify({ type: "message", room, text: "   ", clientMsgId: "c1" }),
    );
    expect(result.ok).toBe(false);
  });

  it("rejects text over 2000 chars", () => {
    const result = parseClientMessage(
      JSON.stringify({ type: "message", room, text: "a".repeat(2001), clientMsgId: "c1" }),
    );
    expect(result.ok).toBe(false);
  });

  it("rejects a room that is not a uuid", () => {
    expect(parseClientMessage(JSON.stringify({ type: "join", room: "general" })).ok).toBe(false);
  });
});
