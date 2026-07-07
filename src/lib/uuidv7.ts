import { randomBytes } from "node:crypto";

let lastMs = 0;
let seq = 0;

export function uuidv7(ms: number = Date.now()): string {
  if (ms > lastMs) {
    lastMs = ms;
    seq = 0;
  } else {
    seq = (seq + 1) & 0xfff;
  }

  const bytes = randomBytes(16);
  bytes.writeUIntBE(ms, 0, 6);
  bytes[6] = 0x70 | (seq >> 8);
  bytes[7] = seq & 0xff;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;

  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
