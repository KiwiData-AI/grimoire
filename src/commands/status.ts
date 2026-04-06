import { Command } from "commander";
import { getChangeStatus } from "../core/status.js";

export const statusCommand = new Command("status")
  .description("Show status of a change (artifacts, tasks)")
  .argument("<change-id>", "Change to inspect")
  .option("--json", "Output as JSON")
  .action(async (changeId: string, options) => {
    await getChangeStatus(changeId, {
      json: options.json ?? false,
    });
  });
