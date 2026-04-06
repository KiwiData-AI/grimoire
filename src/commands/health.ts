import { Command } from "commander";
import { runHealth } from "../core/health.js";

export const healthCommand = new Command("health")
  .description("Show project health score with grimoire coverage metrics")
  .option("--json", "Output as JSON")
  .option(
    "--badges <file>",
    "Write shields.io badges into a file (e.g., README.md)"
  )
  .action(async (options) => {
    await runHealth({
      json: options.json ?? false,
      badges: options.badges,
    });
  });
