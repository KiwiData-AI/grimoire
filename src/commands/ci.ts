import { Command } from "commander";
import { runCi } from "../core/ci.js";

export const ciCommand = new Command("ci")
  .description("Run all grimoire checks for CI (validate + check + test-quality)")
  .option("--annotations", "Output GitHub Actions annotations")
  .option("--skip <steps...>", "Skip specific check steps")
  .option("--setup", "Generate .github/workflows/grimoire.yml template")
  .action(async (options) => {
    const result = await runCi({
      annotations: options.annotations ?? false,
      skip: options.skip,
      setup: options.setup ?? false,
    });
    if (result.exitCode > 0) {
      process.exit(result.exitCode);
    }
  });
