import { Command } from "commander";
import { runCheck } from "../core/check.js";

export const checkCommand = new Command("check")
  .description("Run pre-commit checks (lint, test, duplicates, complexity, LLM review)")
  .argument("[steps...]", "Specific steps to run (default: all configured)")
  .option("--fail-fast", "Stop at first failing step (default: run all)")
  .option("--changed", "Only check changed files (default for LLM steps)")
  .option("--skip <steps...>", "Skip specific steps")
  .option("--json", "Output as JSON")
  .action(async (steps: string[], options) => {
    const { failed, errored } = await runCheck({
      steps: steps.length > 0 ? steps : undefined,
      continueOnFail: !(options.failFast ?? false),
      changed: options.changed ?? true,
      skip: options.skip,
      json: options.json ?? false,
    });
    if (failed > 0) {
      process.exit(1);
    }
  });
