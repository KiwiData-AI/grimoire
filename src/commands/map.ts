import { Command } from "commander";
import { generateMap } from "../core/map.js";

export const mapCommand = new Command("map")
  .description("Scan codebase structure and detect undocumented areas")
  .option("--json", "Output as JSON")
  .option("--refresh", "Compare against existing docs and show gaps")
  .option("--duplicates", "Run jscpd to detect code duplication")
  .option("--depth <n>", "Max directory depth to scan", "4")
  .action(async (options) => {
    await generateMap({
      json: options.json ?? false,
      refresh: options.refresh ?? false,
      duplicates: options.duplicates ?? false,
      maxDepth: parseInt(options.depth, 10),
    });
  });
