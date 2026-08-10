import { createServer } from "node:http";
import { migrate } from "./migrate.js";
import { validateLog } from "./validation/logs.js";
import { insertLogs, listLogs } from "./repositories/logs.js";


const PORT = 8080;

async function main() {
  await migrate ();

  const server = createServer(async (req, res) => {
    if (req.method === "GET" && req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok" }));
      return;
    }

    if (req.method === "POST" && req.url === "/logs") {
      await handleIngestLogs(req, res);
      return;
    }

    if (req.method === "GET" && req.url === "/logs") {
      const logs = await listLogs(100);

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ logs }));
      return;
    }

    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "not found" }));
  });

  server.listen(PORT, () => {
    console.log(`Log Ingestion Service listening on port ${PORT}`);
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
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "malformed JSON" }));
      return;
    }

    if (
      !parsed ||
      typeof parsed !== "object" ||
      Array.isArray(parsed) ||
      !Array.isArray((parsed as Record<string, unknown>).logs)
    ) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          error: "request body must contain a logs array",
        }),
      );
      return;
    }

    const entries = (parsed as { logs: unknown[] }).logs;

    const accepted = [];
    const rejected: { index: number; reason: string }[] = [];

    for (let index = 0; index < entries.length; index++) {
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
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          accepted: 0,
          rejected,
        }),
      );
      return;
    }

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        accepted: accepted.length,
        rejected,
      }),
    );
  } catch (error) {
    console.error("Failed to ingest logs:", error);

    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "internal server error" }));
  }
}

main().catch((error) => {
  console.error("Failed to start service:", error);
  process.exit(1);
});
