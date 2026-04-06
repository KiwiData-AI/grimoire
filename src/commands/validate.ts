import { Command } from "commander";
import { validateChange } from "../core/validate.js";

export const validateCommand = new Command("validate")
  .description("Validate features and decisions in a change")
  .argument("[change-id]", "Change to validate (validates all if omitted)")
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
