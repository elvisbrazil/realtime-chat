import { describe, expect, it } from "vitest";
import { handshakeToken, selectProtocol } from "../src/chat/handshake.js";

describe("handshakeToken", () => {
  it("prefers the query string", () => {
    expect(handshakeToken({ token: "q" }, { "sec-websocket-protocol": "chat, h" })).toBe("q");
  });

  it("falls back to the subprotocol list", () => {
    expect(handshakeToken({}, { "sec-websocket-protocol": "chat, abc.def.ghi" })).toBe(
      "abc.def.ghi",
    );
  });

  it("returns undefined when only the chat protocol is offered", () => {
    expect(handshakeToken({}, { "sec-websocket-protocol": "chat" })).toBeUndefined();
  });
});

describe("selectProtocol", () => {
  it("picks chat and never echoes the token back", () => {
    expect(selectProtocol(new Set(["chat", "abc.def.ghi"]))).toBe("chat");
    expect(selectProtocol(new Set(["abc.def.ghi"]))).toBe(false);
  });
});
