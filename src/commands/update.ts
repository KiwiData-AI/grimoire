import { Command } from "commander";
import { updateProject } from "../core/update.js";

export const updateCommand = new Command("update")
  .description("Update AGENTS.md and skills in an existing project")
  .argument("[path]", "Project root directory", ".")
  .option("--skip-agents", "Skip updating AGENTS.md")
  .option("--skip-skills", "Skip updating Claude Code skills")
  .action(async (path: string, options) => {
    await updateProject(path, {
      skipAgents: options.skipAgents ?? false,
      skipSkills: options.skipSkills ?? false,
    });
  });
