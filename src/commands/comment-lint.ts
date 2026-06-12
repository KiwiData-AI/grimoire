import { Command } from "commander";
import { runCommentLint } from "../core/comment-lint.js";

export const lintCommentsCommand = new Command("lint-comments")
  .description(
    "Lint comments on the changed portion of a write. Intended to run as a Claude Code PreToolUse hook for Write|Edit."
  )
  .option("--hook", "Read PreToolUse payload (JSON) from stdin")
  .option("--mode <mode>", "Override mode: block | warn | off")
  .action(async (options) => {
    const code = await runCommentLint({
      hook: options.hook ?? false,
      mode: options.mode,
    });
    process.exit(code);
  });
