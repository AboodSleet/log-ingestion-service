import type { LogCursor } from "../types/log.js";

export function encodeCursor(cursor: LogCursor): string {
  const json = JSON.stringify(cursor);

  return Buffer.from(json).toString("base64url");
}

export function decodeCursor(value: string): LogCursor {
  const json = Buffer.from(value, "base64url").toString("utf8");

  const parsed: unknown = JSON.parse(json);

  if (
    !parsed ||
    typeof parsed !== "object" ||
    typeof (parsed as Record<string, unknown>).id !== "string" ||
    typeof (parsed as Record<string, unknown>).timestamp !== "string"
  ) {
    throw new Error("invalid cursor");
  }

  return {
    id: (parsed as Record<string, unknown>).id as string,
    timestamp: (parsed as Record<string, unknown>)
      .timestamp as string,
  };
}
