import { Command } from "commander";
import { validateChange } from "../core/validate.js";

export const validateCommand = new Command("validate")
  .description("Validate live specifications and active coordination")
  .argument("[change-id]", "Active change manifest to validate in addition to live specifications")
  .option("--strict", "Enable strict validation")
  .option("--json", "Output as JSON")
  .action(async (changeId: string | undefined, options) => {
    const { errorCount } = await validateChange(changeId, {
      strict: options.strict ?? false,
      json: options.json ?? false,
    });
    if (errorCount > 0) {
      process.exit(1);
    }
  });
