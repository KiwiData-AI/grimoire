import { Command } from "commander";
import { updateProject } from "../core/update.js";

export const updateCommand = new Command("update")
  .description("Update AGENTS.md, skills, templates, hooks, and config in an existing project")
  .argument("[path]", "Project root directory", ".")
  .option("--skip-agents", "Skip updating AGENTS.md and agent files")
  .option("--skip-skills", "Skip updating Claude Code skills")
  .option("--skip-hooks", "Skip updating hooks")
  .option("--skip-templates", "Skip updating template files")
  .option("--force-templates", "Overwrite existing template files")
  .option("--skip-config", "Skip config migration")
  .action(async (path: string, options) => {
    await updateProject(path, {
      skipAgents: options.skipAgents ?? false,
      skipSkills: options.skipSkills ?? false,
      skipHooks: options.skipHooks ?? false,
      skipTemplates: options.skipTemplates ?? false,
      forceTemplates: options.forceTemplates ?? false,
      skipConfig: options.skipConfig ?? false,
    });
  });
