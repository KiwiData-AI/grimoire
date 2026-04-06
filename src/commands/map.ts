import { Command } from "commander";
import { generateMap } from "../core/map.js";

export const mapCommand = new Command("map")
  .description("Scan codebase structure, extract symbols, and detect undocumented areas")
  .option("--json", "Output as JSON")
  .option("--refresh", "Compare against existing docs and show gaps")
  .option("--duplicates", "Run jscpd to detect code duplication")
  .option("--symbols", "Extract function signatures, classes, and exports")
  .option("--compress", "Generate compressed symbol map (.symbols.md) — implies --symbols")
  .option("--depth <n>", "Max directory depth to scan", "4")
  .action(async (options) => {
    const compress = options.compress ?? false;
    await generateMap({
      json: options.json ?? false,
      refresh: options.refresh ?? false,
      duplicates: options.duplicates ?? false,
      symbols: compress || (options.symbols ?? false),
      compress,
      maxDepth: parseInt(options.depth, 10),
    });
  });
