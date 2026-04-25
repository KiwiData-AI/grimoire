import { Command } from "commander";
import { initProject } from "../core/init.js";

export const initCommand = new Command("init")
  .description("Initialize grimoire in a project")
  .argument("[path]", "Project root directory", ".")
  .option("--skip-agents", "Skip generating AGENTS.md instructions")
  .option("--skip-skills", "Skip installing skills for selected agents")
  .option("--no-detect", "Skip auto-detection of project tools")
  .option("--agent <type>", "Add an AI agent: claude, opencode, codex, cursor, copilot (can be repeated)", collect, [])
  .option("--install-codebase-memory-mcp", "Mark codebase-memory-mcp as a recommended integration (prints install command at end)")
  .option("--install-caveman-plugin", "Mark caveman skill plugin as a recommended integration (prints install command at end)")
  .action(async (path: string, options) => {
    await initProject(path, {
      skipAgents: options.skipAgents ?? false,
      skipSkills: options.skipSkills ?? false,
      noDetect: options.detect === false,
      agents: options.agent ?? [],
      installCodebaseMemoryMcp: options.installCodebaseMemoryMcp,
      installCavemanPlugin: options.installCavemanPlugin,
    });
  });

function collect(value: string, previous: string[]): string[] {
  return previous.concat([value]);
}
