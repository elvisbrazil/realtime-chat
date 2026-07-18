import type { IncomingHttpHeaders } from "node:http";

export const SUBPROTOCOL = "chat";

export function selectProtocol(protocols: Set<string>): string | false {
  return protocols.has(SUBPROTOCOL) ? SUBPROTOCOL : false;
}

export function handshakeToken(
  query: { token?: string },
  headers: IncomingHttpHeaders,
): string | undefined {
  if (query.token) return query.token;

  const offered = headers["sec-websocket-protocol"];
  if (!offered) return undefined;
  return offered
    .split(",")
    .map((p) => p.trim())
    .find((p) => p && p !== SUBPROTOCOL);
}
