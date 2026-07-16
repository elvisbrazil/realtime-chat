import type { ChatMessage } from "../chat/protocol.js";

export type RoomEvent =
  | { type: "message"; from: string; message: ChatMessage }
  | { type: "typing"; from: string; room: string; user: string; isTyping: boolean }
  | { type: "presence"; room: string; user: string; status: "online" | "offline" };

export type RoomEventHandler = (event: RoomEvent) => void;

export interface Broker {
  publish(room: string, event: RoomEvent): Promise<void>;
  subscribe(room: string, handler: RoomEventHandler): Promise<() => Promise<void>>;
  close(): Promise<void>;
}
