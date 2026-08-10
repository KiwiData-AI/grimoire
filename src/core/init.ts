import { mkdir, writeFile, copyFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { stringify as yamlStringify } from "yaml";
import chalk from "chalk";
import type { Detection } from "./detect.js";
import type { GrimoireConfig, SteLevel } from "../utils/config.js";
import { setupHooks } from "./hooks.js";
import { fileExists } from "../utils/fs.js";
import {
  upsertAgentsFile,
  ensureClaudeAgentsImport,
  installSkillFiles,
  SKILL_NAMES,
  GRIMOIRE_DIRS,
  TEMPLATE_FILES,
  generateAgentFiles,
  printStePluginInstructions,
} from "./shared-setup.js";
import { runSections, type SectionName } from "./configure.js";
import {
  buildMinimalConfig,
  buildIntegrationFlags,
  scanForSecrets,
} from "./init-config.js";
import { buildDetectedConfig } from "./init-prompts.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = join(__dirname, "..", "..");

interface InitOptions {
  skipAgents: boolean;
  skipSkills: boolean;
  noDetect: boolean;
  agents: string[];
  full: boolean;
  installCodebaseMemoryMcp?: boolean;
  installStePlugin?: boolean;
}

interface ConfigSetupResult {
  steLevel: SteLevel;
  commentStyle?: string;
  packageManager?: string;
  pydoclintConfigured: boolean;
  configAgents: string[];
  integrationFlags: { codebaseMemoryMcp: boolean | undefined; stePlugin: boolean | undefined };
  figmaMcpConfigured: boolean;
  projectDetection: Detection | null;
}

async function runFullConfigSections(root: string, config: GrimoireConfig): Promise<void> {
  const ALL_SECTIONS: SectionName[] = ["tools", "compliance", "llm", "trackers", "testing"];
  const readline = await import("node:readline/promises");
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  console.log(chalk.bold("\n  Advanced configuration (--full):\n"));
  await runSections(rl, config, root, ALL_SECTIONS);
  rl.close();
  const fullSerialized = yamlStringify(config);
  scanForSecrets(fullSerialized);
  await writeFile(join(root, ".grimoire", "config.yaml"), fullSerialized);
}

async function createGrimoireConfig(
  root: string,
  options: InitOptions,
  initialFlags: { codebaseMemoryMcp: boolean | undefined; stePlugin: boolean | undefined }
): Promise<ConfigSetupResult> {
  let projectDetection: Detection | null = null;
  let config: GrimoireConfig;

  if (options.noDetect) {
    config = buildMinimalConfig();
  } else {
    const result = await buildDetectedConfig(root, initialFlags);
    config = result.config;
    projectDetection = result.detection;
  }

  const integrationFlags = buildIntegrationFlags(initialFlags, config);

  const serialized = yamlStringify(config);
  scanForSecrets(serialized);
  await writeFile(join(root, ".grimoire", "config.yaml"), serialized);
  console.log(`  ${chalk.green("created")} .grimoire/config.yaml`);

  if (options.full) await runFullConfigSections(root, config);

  return {
    steLevel: config.project.ste ?? "ste",
    commentStyle: config.project.comment_style,
    packageManager: config.project.package_manager,
    pydoclintConfigured: config.tools.doc_style?.name === "pydoclint",
    configAgents: config.project.agents ?? [],
    integrationFlags,
    figmaMcpConfigured: config.project.design_tool?.mcp?.name === "figma-dev-mode",
    projectDetection,
  };
}

async function loadExistingConfig(
  root: string,
  initialFlags: { codebaseMemoryMcp: boolean | undefined; stePlugin: boolean | undefined }
): Promise<Omit<ConfigSetupResult, "projectDetection">> {
  console.log(`  ${chalk.yellow("exists")}  .grimoire/config.yaml`);
  const { loadConfig } = await import("../utils/config.js");
  const existing = await loadConfig(root);
  return {
    steLevel: existing.project.ste ?? "off",
    commentStyle: existing.project.comment_style,
    packageManager: existing.project.package_manager,
    pydoclintConfigured: existing.tools.doc_style?.name === "pydoclint",
    configAgents: existing.project.agents ?? [],
    integrationFlags: {
      codebaseMemoryMcp: initialFlags.codebaseMemoryMcp ?? existing.project.integrations?.codebase_memory_mcp,
      stePlugin: initialFlags.stePlugin ?? existing.project.integrations?.ste_plugin,
    },
    figmaMcpConfigured: existing.project.design_tool?.mcp?.name === "figma-dev-mode",
  };
}

function printNextSteps(isExistingProject: boolean, full: boolean): void {
  console.log(`\n${chalk.bold.green("Done!")} Grimoire initialized.\n`);
  console.log("Directory structure:");
  console.log("  features/              Gherkin feature files (behavioral specs)");
  console.log("  .grimoire/decisions/   MADR decision records (architectural specs)");
  console.log("  .grimoire/docs/        Project docs, data schema, and context");
  console.log("  .grimoire/changes/     Changes in progress");
  console.log("  .grimoire/archive/     Completed changes\n");
  console.log("Next steps:");
  if (isExistingProject) {
    console.log("  1. Install codebase-memory-mcp (required for code discovery):");
    console.log("     macOS / Linux: curl -fsSL https://raw.githubusercontent.com/DeusData/codebase-memory-mcp/main/install.sh | bash");
    console.log("  2. Run /grimoire:discover in your agent to generate conventions files and data schema");
    console.log("  3. Run /grimoire:audit in your agent to document existing features and decisions\n");
  } else {
    console.log("  Run /grimoire:draft in your agent to write your first feature spec\n");
  }
  if (!full) {
    console.log(chalk.dim("  Run `grimoire configure` to set compliance, design tool, LLM models, bug trackers, and testing tools.\n"));
  }
}

const SKILL_SUPPORTED = ["claude", "opencode", "codex"];
const INSTRUCTION_SUPPORTED = ["cursor", "copilot"];

async function scaffoldProject(root: string): Promise<void> {
  for (const dir of GRIMOIRE_DIRS) {
    await mkdir(join(root, dir), { recursive: true });
    console.log(`  ${chalk.green("created")} ${dir}/`);
  }
  for (const [src, dest] of TEMPLATE_FILES) {
    const destPath = join(root, dest);
    if (!(await fileExists(destPath))) {
      await copyFile(join(PACKAGE_ROOT, "templates", src), destPath);
      console.log(`  ${chalk.green("created")} ${dest}`);
    } else {
      console.log(`  ${chalk.yellow("exists")}  ${dest}`);
    }
  }
}

async function setupAgents(root: string, options: InitOptions, setup: ConfigSetupResult): Promise<void> {
  const allAgents = Array.from(new Set([...setup.configAgents, ...options.agents]));
  const skillAgents = allAgents.filter((a) => SKILL_SUPPORTED.includes(a));
  const instructionAgents = allAgents.filter((a) => INSTRUCTION_SUPPORTED.includes(a));

  for (const a of allAgents) {
    if (!SKILL_SUPPORTED.includes(a) && !INSTRUCTION_SUPPORTED.includes(a)) {
      console.log(`  ${chalk.yellow("unknown")} agent type: ${a} (supported: ${[...SKILL_SUPPORTED, ...INSTRUCTION_SUPPORTED].join(", ")})`);
    }
  }

  if (!options.skipAgents) await setupAgentsFile(root, setup.steLevel, setup.commentStyle);
  if (!options.skipSkills) await installSkills(root, skillAgents.length > 0 ? skillAgents : ["claude"]);
  if (instructionAgents.length > 0) await generateAgentFiles(root, PACKAGE_ROOT, instructionAgents, "created");
  if (!options.skipAgents) await setupHooks(root);
}

export async function initProject(
  projectPath: string,
  options: InitOptions
): Promise<void> {
  const root = join(process.cwd(), projectPath);
  console.log(chalk.bold("Initializing grimoire...\n"));

  await scaffoldProject(root);

  const configPath = join(root, ".grimoire", "config.yaml");
  const initialFlags = { codebaseMemoryMcp: options.installCodebaseMemoryMcp, stePlugin: options.installStePlugin };
  const setup = await fileExists(configPath)
    ? { ...(await loadExistingConfig(root, initialFlags)), projectDetection: null as Detection | null }
    : await createGrimoireConfig(root, options, initialFlags);

  await setupAgents(root, options, setup);

  printNextSteps(!!setup.projectDetection?.name, options.full);
  printIntegrationInstructions({
    ...setup.integrationFlags,
    figmaMcp: setup.figmaMcpConfigured,
    pydoclint: setup.pydoclintConfigured,
    packageManager: setup.packageManager,
  });
}

const PYDOCLINT_INSTALL: Record<string, string> = {
  uv: "uv add --dev pydoclint",
  poetry: "poetry add --group dev pydoclint",
  pip: "pip install pydoclint",
};

function printIntegrationInstructions(flags: {
  codebaseMemoryMcp?: boolean;
  stePlugin?: boolean;
  figmaMcp?: boolean;
  pydoclint?: boolean;
  packageManager?: string;
}): void {
  if (!flags.codebaseMemoryMcp && !flags.stePlugin && !flags.figmaMcp && !flags.pydoclint)
    return;

  console.log(chalk.bold("Recommended integrations to install:\n"));

  if (flags.codebaseMemoryMcp) {
    console.log(
      `  ${chalk.cyan("codebase-memory-mcp")} — call graphs, dead-code detection, cross-service routes`
    );
    console.log("    macOS / Linux:");
    console.log(
      `      ${chalk.dim("curl -fsSL https://raw.githubusercontent.com/DeusData/codebase-memory-mcp/main/install.sh | bash")}`
    );
    console.log("    Windows (PowerShell):");
    console.log(
      `      ${chalk.dim("Invoke-WebRequest https://raw.githubusercontent.com/DeusData/codebase-memory-mcp/main/install.ps1 -OutFile install.ps1; .\\install.ps1")}`
    );
    console.log(`    Restart your agent, then say "Index this project".\n`);
  }

  if (flags.stePlugin) printStePluginInstructions();

  if (flags.pydoclint) printPydoclintInstructions(flags.packageManager);

  if (flags.figmaMcp) {
    console.log(
      `  ${chalk.cyan("Figma Dev Mode MCP")} — read Figma frames, variables, and components from the AI agent`
    );
    console.log("    Set your access token in your shell environment:");
    console.log(`      ${chalk.dim("export FIGMA_ACCESS_TOKEN=...")}`);
    console.log(
      "    Install the Figma desktop app and enable Dev Mode for full feature access."
    );
    console.log(
      `    Restart your agent. The MCP server will spawn via the command in config.yaml.\n`
    );
  }
}

function printPydoclintInstructions(packageManager?: string): void {
  const install = PYDOCLINT_INSTALL[packageManager ?? ""] ?? PYDOCLINT_INSTALL.pip;
  console.log(
    `  ${chalk.cyan("pydoclint")} — enforces the configured docstring style at the doc_style commit gate`
  );
  console.log(`      ${chalk.dim(install)}`);
  console.log(
    `    ${chalk.dim("For a codebase with existing drift: pydoclint --generate-baseline 1 . then commit the baseline file.")}\n`
  );
}

async function setupAgentsFile(
  root: string,
  ste: SteLevel,
  commentStyle?: string
): Promise<void> {
  await upsertAgentsFile(root, PACKAGE_ROOT, "created", ste, commentStyle);
  await ensureClaudeAgentsImport(root);
}

async function installSkills(root: string, agents: string[]): Promise<void> {
  await installSkillFiles(root, PACKAGE_ROOT, SKILL_NAMES, "created", agents);
}
