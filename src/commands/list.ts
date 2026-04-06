import { Command } from "commander";
import { listChanges, listFeatures, listDecisions } from "../core/list.js";

export const listCommand = new Command("list")
  .description("List changes, features, or decisions")
  .option("--changes", "List active changes")
  .option("--features", "List feature files")
  .option("--decisions", "List decision records")
  .option("--json", "Output as JSON")
  .action(async (options) => {
    const json = options.json ?? false;

    // Default to listing changes if no flag specified
    if (!options.features && !options.decisions) {
      await listChanges(json);
    }
    if (options.features) {
      await listFeatures(json);
    }
    if (options.decisions) {
      await listDecisions(json);
    }
  });
