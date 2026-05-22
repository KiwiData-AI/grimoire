import { Command } from "commander";
import { runMap, McpRequiredError } from "../core/map.js";

export const mapCommand = new Command("map")
  .description("Detect drift between conventions files and the current codebase")
  .option("--duplicates", "Run jscpd to detect code duplication")
  .action(async (options) => {
    try {
      await runMap({ duplicates: options.duplicates ?? false });
    } catch (e) {
      if (e instanceof McpRequiredError) process.exit(1);
      throw e;
    }
  });
