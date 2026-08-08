import { migrate } from "./migrate";

async function main() {
  await migrate();

  console.log("Log Ingestion Service");
}

main().catch((error) => {
  console.error("Application failed to start:", error);
  process.exit(1);
});
