import { Command } from "commander";
import { initCommand } from "../commands/init.js";
import { updateCommand } from "../commands/update.js";
import { validateCommand } from "../commands/validate.js";
import { listCommand } from "../commands/list.js";
import { statusCommand } from "../commands/status.js";
import { archiveCommand } from "../commands/archive.js";
import { mapCommand } from "../commands/map.js";
import { checkCommand } from "../commands/check.js";
import { logCommand } from "../commands/log.js";
import { traceCommand } from "../commands/trace.js";
import { docsCommand } from "../commands/docs.js";
import { healthCommand } from "../commands/health.js";
import { prCommand } from "../commands/pr.js";
import { testQualityCommand } from "../commands/test-quality.js";
import { diffCommand } from "../commands/diff.js";
import { ciCommand } from "../commands/ci.js";
import { branchCheckCommand } from "../commands/branch-check.js";

const program = new Command();

program
  .name("grimoire")
  .description(
    "Gherkin + MADR spec-driven development for AI coding assistants"
  )
  .version("0.1.2");

program.addCommand(initCommand);
program.addCommand(updateCommand);
program.addCommand(validateCommand);
program.addCommand(listCommand);
program.addCommand(statusCommand);
program.addCommand(archiveCommand);
program.addCommand(mapCommand);
program.addCommand(checkCommand);
program.addCommand(logCommand);
program.addCommand(traceCommand);
program.addCommand(docsCommand);
program.addCommand(healthCommand);
program.addCommand(prCommand);
program.addCommand(testQualityCommand);
program.addCommand(diffCommand);
program.addCommand(ciCommand);
program.addCommand(branchCheckCommand);

program.parse();
