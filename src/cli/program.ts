import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { Command } from "commander";
import { initCommand } from "../commands/init.js";
import { updateCommand } from "../commands/update.js";
import { validateCommand } from "../commands/validate.js";
import { listCommand } from "../commands/list.js";
import { statusCommand } from "../commands/status.js";
import { checkCommand } from "../commands/check.js";
import { traceCommand } from "../commands/trace.js";
import { docsCommand } from "../commands/docs.js";
import { healthCommand } from "../commands/health.js";
import { prCommand } from "../commands/pr.js";
import { testQualityCommand } from "../commands/test-quality.js";
import { diffCommand } from "../commands/diff.js";
import { ciCommand } from "../commands/ci.js";
import { branchCheckCommand } from "../commands/branch-check.js";
import { lintCommentsCommand } from "../commands/comment-lint.js";
import { configureCommand } from "../commands/configure.js";

const pkg = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "..", "package.json"), "utf-8")
) as { version: string };

/** Build the configured CLI. Single source for the executable and the docs generator. */
export function buildProgram(): Command {
  const program = new Command();

  program
    .name("grimoire")
    .description("Gherkin + MADR spec-driven development for AI coding assistants")
    .version(pkg.version);

  program.addCommand(initCommand);
  program.addCommand(updateCommand);
  program.addCommand(validateCommand);
  program.addCommand(listCommand);
  program.addCommand(statusCommand);
  program.addCommand(checkCommand);
  program.addCommand(traceCommand);
  program.addCommand(docsCommand);
  program.addCommand(healthCommand);
  program.addCommand(prCommand);
  program.addCommand(testQualityCommand);
  program.addCommand(diffCommand);
  program.addCommand(ciCommand);
  program.addCommand(branchCheckCommand);
  program.addCommand(lintCommentsCommand);
  program.addCommand(configureCommand);

  return program;
}
