import { Command } from "commander";
import { traceFile } from "../core/trace.js";

export const traceCommand = new Command("trace")
  .description("Trace a file back to the grimoire change that created it")
  .argument("<file>", "File path (optionally with :line, e.g. src/auth.py:42)")
  .option("--json", "Output as JSON")
  .action(async (file: string, options) => {
    await traceFile(file, {
      json: options.json ?? false,
    });
  });
