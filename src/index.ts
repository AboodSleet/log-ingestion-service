import { createServer } from "node:http";
import { migrate } from "./migrate.js";
import { validateLog } from "./validation/logs.js";
import { insertLogs, listLogs } from "./repositories/logs.js";
import { encodeCursor, decodeCursor } from "./pagination/cursor.js";
import { parseFilters } from "./filters.js";
import { validateFilters } from "./validation/filters.js";
import { deleteExpiredLogs } from "./retention/cleanup.js";


const PORT = 8080;

const RETENTION_DAYS = Number(
  process.env.LOG_RETENTION_DAYS ?? 30,
);

const RETENTION_INTERVAL_MS =
  60 * 60 * 1000;


async function main() {
  await migrate();

  try {
    const deleted = await deleteExpiredLogs(
      RETENTION_DAYS,
    );

    console.log(
      `Retention cleanup: deleted ${deleted} expired logs`,
    );
  } catch (error) {
    console.error(
      "Retention cleanup failed:",
      error,
    );
  }

  setInterval(async () => {
    try {
      const deleted = await deleteExpiredLogs(
        RETENTION_DAYS,
      );

      console.log(
        `Retention cleanup: deleted ${deleted} expired logs`,
      );
    } catch (error) {
      console.error(
        "Retention cleanup failed:",
        error,
      );
    }
  }, RETENTION_INTERVAL_MS);

  const server = createServer(async (req, res) => {
    if (req.method === "GET" && req.url === "/health") {
      res.writeHead(200, {
        "Content-Type": "application/json",
      });

      res.end(JSON.stringify({ status: "ok" }));
      return;
    }

    if (req.method === "POST" && req.url === "/logs") {
      await handleIngestLogs(req, res);
      return;
    }

    if (req.method === "GET" && req.url) {
      const url = new URL(
        req.url,
        `http://${req.headers.host}`,
      );

      if (url.pathname === "/logs") {
        const filters = parseFilters(url.searchParams);

        const filterError = validateFilters(filters);

        if (filterError !== null) {
          res.writeHead(400, {
            "Content-Type": "application/json",
          });

          res.end(
            JSON.stringify({
              error: filterError,
            }),
          );

          return;
        }

        const limit = filters.limit ?? 100;

        let cursor;

        if (filters.cursor !== undefined) {
          try {
            cursor = decodeCursor(filters.cursor);
          } catch {
            res.writeHead(400, {
              "Content-Type": "application/json",
            });

            res.end(
              JSON.stringify({
                error: "invalid cursor",
              }),
            );

            return;
          }
        }

        const logs = await listLogs(
          limit,
          cursor,
          filters,
        );

        let nextCursor: string | null = null;

        if (logs.length === limit) {
          const lastLog = logs[logs.length - 1];

          if (!lastLog) {
            throw new Error(
              "Expected last log to exist",
            );
          }

          nextCursor = encodeCursor({
            timestamp: lastLog.timestamp.toISOString(),
            id: lastLog.id,
          });
        }

        res.writeHead(200, {
          "Content-Type": "application/json",
        });

        res.end(
          JSON.stringify({
            logs,
            next_cursor: nextCursor,
          }),
        );

        return;
      }
    }

    res.writeHead(404, {
      "Content-Type": "application/json",
    });

    res.end(JSON.stringify({ error: "not found" }));
  });

  server.listen(PORT, () => {
    console.log(
      `Log Ingestion Service listening on port ${PORT}`,
    );
  });
}

async function handleIngestLogs(
  req: import("node:http").IncomingMessage,
  res: import("node:http").ServerResponse,
) {
  try {
    const chunks: Buffer[] = [];

    for await (const chunk of req) {
      chunks.push(Buffer.from(chunk));
    }

    const body = Buffer.concat(chunks).toString("utf8");

    let parsed: unknown;

    try {
      parsed = JSON.parse(body);
    } catch {
      res.writeHead(400, {
        "Content-Type": "application/json",
      });

      res.end(
        JSON.stringify({
          error: "malformed JSON",
        }),
      );

      return;
    }

    if (
      !parsed ||
      typeof parsed !== "object" ||
      Array.isArray(parsed) ||
      !Array.isArray(
        (parsed as Record<string, unknown>).logs,
      )
    ) {
      res.writeHead(400, {
        "Content-Type": "application/json",
      });

      res.end(
        JSON.stringify({
          error: "request body must contain a logs array",
        }),
      );

      return;
    }

    const entries = (parsed as { logs: unknown[] }).logs;

    const accepted = [];
    const rejected: {
      index: number;
      reason: string;
    }[] = [];

    for (
      let index = 0;
      index < entries.length;
      index++
    ) {
      const result = validateLog(entries[index]);

      if (result.valid) {
        accepted.push(result.log);
      } else {
        rejected.push({
          index,
          reason: result.reason,
        });
      }
    }

    if (accepted.length > 0) {
      await insertLogs(accepted);
    }

    if (accepted.length === 0) {
      res.writeHead(400, {
        "Content-Type": "application/json",
      });

      res.end(
        JSON.stringify({
          accepted: 0,
          rejected,
        }),
      );

      return;
    }

    res.writeHead(200, {
      "Content-Type": "application/json",
    });

    res.end(
      JSON.stringify({
        accepted: accepted.length,
        rejected,
      }),
    );
  } catch (error) {
    console.error(
      "Failed to ingest logs:",
      error,
    );

    res.writeHead(500, {
      "Content-Type": "application/json",
    });

    res.end(
      JSON.stringify({
        error: "internal server error",
      }),
    );
  }
}

main().catch((error) => {
  console.error(
    "Failed to start service:",
    error,
  );

  process.exit(1);
});
