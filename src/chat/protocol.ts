import { z } from "zod";

const roomId = z.uuid();

export const clientMessageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("join"), room: roomId }),
  z.object({ type: z.literal("leave"), room: roomId }),
  z.object({
    type: z.literal("message"),
    room: roomId,
    text: z.string().trim().min(1).max(2000),
    clientMsgId: z.string().min(1).max(64),
  }),
  z.object({ type: z.literal("typing"), room: roomId, isTyping: z.boolean() }),
]);

export type ClientMessage = z.infer<typeof clientMessageSchema>;

export type ErrorCode =
  | "bad_request"
  | "unknown_room"
  | "not_joined"
  | "rate_limited"
  | "too_large"
  | "internal";

export interface ChatMessage {
  id: string;
  room: string;
  author: string;
  text: string;
  createdAt: string;
}

export type ServerEvent =
  | { type: "message"; message: ChatMessage }
  | { type: "ack"; clientMsgId: string; id: string; createdAt: string }
  | { type: "presence"; room: string; users: string[] }
  | { type: "typing"; room: string; user: string; isTyping: boolean }
  | { type: "error"; code: ErrorCode; message: string; clientMsgId?: string };

export type ParseResult = { ok: true; message: ClientMessage } | { ok: false; error: string };

export function parseClientMessage(raw: string): ParseResult {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { ok: false, error: "invalid JSON" };
  }

  const result = clientMessageSchema.safeParse(data);
  if (!result.success) {
    return { ok: false, error: z.prettifyError(result.error) };
  }
  return { ok: true, message: result.data };
}
