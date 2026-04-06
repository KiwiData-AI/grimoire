import { Command } from "commander";
import { diffChange } from "../core/diff.js";

export const diffCommand = new Command("diff")
  .description("Compare proposed change specs against the baseline")
  .argument("<change-id>", "The change to diff")
  .option("--json", "Output as JSON")
  .action(async (changeId: string, options) => {
    await diffChange(changeId, { json: options.json ?? false });
  });
