import { Command } from "commander";
import { runBranchCheck } from "../core/branch-check.js";

export const branchCheckCommand = new Command("branch-check")
  .description(
    "Detect new-feature intent and warn when current branch is stale or dirty. Intended to run as a Claude Code UserPromptSubmit hook."
  )
  .option("--hook", "Read hook payload (JSON) from stdin")
  .option("--prompt <text>", "Evaluate an explicit prompt string")
  .option("--json", "Emit result as JSON")
  .action(async (options) => {
    const code = await runBranchCheck({
      hook: options.hook ?? false,
      prompt: options.prompt,
      json: options.json ?? false,
    });
    process.exit(code);
  });
