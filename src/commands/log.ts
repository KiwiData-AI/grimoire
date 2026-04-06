import { Command } from "commander";
import { generateLog } from "../core/log.js";

export const logCommand = new Command("log")
  .description("Generate change log from archived grimoire changes")
  .option("--from <ref>", "Start date or git tag (inclusive)")
  .option("--to <ref>", "End date or git tag (inclusive)")
  .option("--json", "Output as JSON")
  .action(async (options) => {
    await generateLog({
      from: options.from,
      to: options.to,
      json: options.json ?? false,
    });
  });
