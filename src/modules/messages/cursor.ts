export interface Cursor {
  createdAt: Date;
  id: string;
}

export function encodeCursor({ createdAt, id }: Cursor): string {
  return Buffer.from(`${createdAt.toISOString()}|${id}`).toString("base64url");
}

export function decodeCursor(value: string): Cursor | null {
  const [iso, id] = Buffer.from(value, "base64url").toString("utf8").split("|");
  if (!iso || !id) return null;
  const createdAt = new Date(iso);
  if (Number.isNaN(createdAt.getTime())) return null;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  return { createdAt, id };
}
