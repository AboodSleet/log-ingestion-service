import { sql } from "../db.js";
import type { LogEntry } from "../types/log.js";


export async function insertLogs(logs: LogEntry[]) {
  if (logs.length === 0) {
    return;
  }

  await sql`
    INSERT INTO logs ${sql(
      logs.map((log) => ({
        id: crypto.randomUUID(),
        timestamp: log.timestamp,
        level: log.level,
        service: log.service,
        message: log.message,
        attributes: JSON.stringify(log.attributes ?? {}),
      })),
    )}
  `;
}
