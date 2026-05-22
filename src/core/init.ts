import { mkdir, writeFile, copyFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { stringify as yamlStringify } from "yaml";
import chalk from "chalk";
import { detectTools, type Detection } from "./detect.js";
import type {
  GrimoireConfig,
  ToolConfig,
  CavemanLevel,
  ProjectSurface,
} from "../utils/config.js";
import { setupHooks } from "./hooks.js";
import { fileExists } from "../utils/fs.js";
import {
  upsertAgentsFile,
  installSkillFiles,
  SKILL_NAMES,
  GRIMOIRE_DIRS,
  TEMPLATE_FILES,
  generateAgentFiles,
  detectAgentFiles,
} from "./shared-setup.js";
import { runSections, type SectionName } from "./configure.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = join(__dirname, "..", "..");

interface InitOptions {
  skipAgents: boolean;
  skipSkills: boolean;
  noDetect: boolean;
  agents: string[];
  full: boolean;
  installCodebaseMemoryMcp?: boolean;
  installCavemanPlugin?: boolean;
}

const CATEGORY_LABELS: Record<string, string> = {
  language: "Language",
  package_manager: "Pkg manager",
  lint: "Linter",
  format: "Formatter",
  unit_test: "Unit tests",
  bdd_test: "BDD tests",
  complexity: "Complexity",
  security: "Security",
  dep_audit: "Dep audit",
  secrets: "Secrets",
  dead_code: "Dead code",
  doc_tool: "Doc tool",
  comment_style: "Comment style",
};

const CATEGORY_ORDER = [
  "language",
  "package_manager",
  "lint",
  "format",
  "unit_test",
  "bdd_test",
  "complexity",
  "security",
  "dep_audit",
  "secrets",
  "dead_code",
  "doc_tool",
  "comment_style",
];

interface ConfigSetupResult {
  cavemanLevel: CavemanLevel;
  configAgents: string[];
  integrationFlags: { codebaseMemoryMcp: boolean | undefined; cavemanPlugin: boolean | undefined };
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

function buildIntegrationFlags(
  initialFlags: { codebaseMemoryMcp: boolean | undefined; cavemanPlugin: boolean | undefined },
  config: GrimoireConfig,
): { codebaseMemoryMcp: boolean | undefined; cavemanPlugin: boolean | undefined } {
  return {
    codebaseMemoryMcp: initialFlags.codebaseMemoryMcp ?? config.project.integrations?.codebase_memory_mcp,
    cavemanPlugin: initialFlags.cavemanPlugin ?? config.project.integrations?.caveman_plugin,
  };
}

async function createGrimoireConfig(
  root: string,
  options: InitOptions,
  initialFlags: { codebaseMemoryMcp: boolean | undefined; cavemanPlugin: boolean | undefined }
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
    cavemanLevel: config.project.caveman ?? "lite",
    configAgents: config.project.agents ?? [],
    integrationFlags,
    figmaMcpConfigured: config.project.design_tool?.mcp?.name === "figma-dev-mode",
    projectDetection,
  };
}

async function loadExistingConfig(
  root: string,
  initialFlags: { codebaseMemoryMcp: boolean | undefined; cavemanPlugin: boolean | undefined }
): Promise<Omit<ConfigSetupResult, "projectDetection">> {
  console.log(`  ${chalk.yellow("exists")}  .grimoire/config.yaml`);
  const { loadConfig } = await import("../utils/config.js");
  const existing = await loadConfig(root);
  return {
    cavemanLevel: existing.project.caveman ?? "none",
    configAgents: existing.project.agents ?? [],
    integrationFlags: {
      codebaseMemoryMcp: initialFlags.codebaseMemoryMcp ?? existing.project.integrations?.codebase_memory_mcp,
      cavemanPlugin: initialFlags.cavemanPlugin ?? existing.project.integrations?.caveman_plugin,
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

  if (!options.skipAgents) await setupAgentsFile(root, setup.cavemanLevel);
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
  const initialFlags = { codebaseMemoryMcp: options.installCodebaseMemoryMcp, cavemanPlugin: options.installCavemanPlugin };
  const setup = await fileExists(configPath)
    ? { ...(await loadExistingConfig(root, initialFlags)), projectDetection: null as Detection | null }
    : await createGrimoireConfig(root, options, initialFlags);

  await setupAgents(root, options, setup);

  printNextSteps(!!setup.projectDetection?.name, options.full);
  printIntegrationInstructions({ ...setup.integrationFlags, figmaMcp: setup.figmaMcpConfigured });
}

function printIntegrationInstructions(flags: {
  codebaseMemoryMcp?: boolean;
  cavemanPlugin?: boolean;
  figmaMcp?: boolean;
}): void {
  if (!flags.codebaseMemoryMcp && !flags.cavemanPlugin && !flags.figmaMcp)
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

  if (flags.cavemanPlugin) {
    console.log(
      `  ${chalk.cyan("caveman skill plugin")} — token-efficient response style for Claude Code`
    );
    console.log("    In Claude Code:");
    console.log(
      `      ${chalk.dim("/plugin marketplace add JuliusBrussee/caveman")}`
    );
    console.log(
      `      ${chalk.dim("/plugin install caveman@JuliusBrussee/caveman")}\n`
    );
  }

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

const SECRET_PATTERN =
  /(.*_TOKEN|.*_KEY|.*_SECRET|.*_PASSWORD)\s*[:=]\s*[^$\s].*/i;

export function scanForSecrets(serialized: string): void {
  for (const line of serialized.split("\n")) {
    const m = line.match(SECRET_PATTERN);
    if (!m) continue;
    const value = line.slice(line.search(/[:=]/) + 1).trim();
    if (value.startsWith("${")) continue;
    throw new Error(
      `Refusing to write a secret to .grimoire/config.yaml: ${line.trim()}\n` +
        `Use \${ENV_VAR} references instead, then export the value in your shell.`
    );
  }
}

function buildMinimalConfig(): GrimoireConfig {
  return {
    version: 1,
    project: {
      commit_style: "conventional",
    },
    features_dir: "features",
    decisions_dir: ".grimoire/decisions",
    tools: {},
    checks: [
      "lint",
      "format",
      "duplicates",
      "complexity",
      "dead_code",
      "unit_test",
      "bdd_test",
      "security",
      "dep_audit",
      "secrets",
      "best_practices",
    ],
    llm: {
      thinking: { command: "claude" },
      coding: { command: "claude" },
    },
  };
}

interface EssentialPrefill {
  codebaseMemoryMcp?: boolean;
  cavemanPlugin?: boolean;
  detectedSurface?: ProjectSurface;
}

function bestByCategory(detections: Detection[]): Map<string, Detection> {
  const byCategory = new Map<string, Detection>();
  for (const d of detections) {
    const existing = byCategory.get(d.category);
    if (!existing || confidenceRank(d.confidence) > confidenceRank(existing.confidence)) {
      byCategory.set(d.category, d);
    }
  }
  return byCategory;
}

function applyProjectDetections(config: GrimoireConfig, byCategory: Map<string, Detection>): void {
  const projectFields: Array<[string, keyof typeof config.project]> = [
    ["language", "language"],
    ["package_manager", "package_manager"],
    ["doc_tool", "doc_tool"],
    ["comment_style", "comment_style"],
  ];
  for (const [cat, field] of projectFields) {
    const d = byCategory.get(cat);
    if (d) (config.project as unknown as Record<string, unknown>)[field] = d.name;
  }
  const projectCategories = new Set(["language", "package_manager", "doc_tool", "comment_style"]);
  for (const [category, detection] of byCategory) {
    if (projectCategories.has(category)) continue;
    const tool: ToolConfig = { name: detection.name };
    if (detection.command) tool.command = detection.command;
    if (detection.check_command) tool.check_command = detection.check_command;
    config.tools[category] = tool;
  }
}

function applyLlmFallbacks(config: GrimoireConfig, byCategory: Map<string, Detection>): void {
  if (!byCategory.has("security")) {
    config.tools.security = { name: "llm", prompt: "Review these changed files for security vulnerabilities. Tag each finding with OWASP Top 10 category and CWE ID. Check for: SQL injection (CWE-89), XSS (CWE-79), broken auth (CWE-287), insecure crypto (CWE-327), SSRF (CWE-918), path traversal (CWE-22), insecure deserialization (CWE-502), missing access control (CWE-862), CSRF (CWE-352), hardcoded secrets (CWE-798)." };
  }
  if (!byCategory.has("dep_audit")) {
    config.tools.dep_audit = { name: "llm", prompt: "Review these changed files for newly added dependencies or imports. Flag potential typosquatting (CWE-1357), packages you cannot verify as real, and packages with known security advisories. Check for misspellings (e.g., 'reqeusts' instead of 'requests')." };
  }
  if (!byCategory.has("secrets")) {
    config.tools.secrets = { name: "llm", prompt: "Review these changed files for hardcoded secrets (CWE-798), API keys, passwords, tokens, private keys, or credentials (CWE-312). Flag any string that looks like a secret value rather than a placeholder or environment variable reference." };
  }
  if (!byCategory.has("dead_code")) {
    config.tools.dead_code = { name: "llm", prompt: "Review these changed files for dead code: unused functions, unreachable branches, unused imports, unused variables, and exports that are never imported elsewhere. Only flag code that is clearly dead, not code that might be used dynamically." };
  }
  config.tools.best_practices = { name: "llm", prompt: "Review these changed files for best practices violations" };
  if (!config.tools.duplicates) {
    config.tools.duplicates = { name: "jscpd", command: "npx jscpd --reporters console" };
  }
}

async function buildDetectedConfig(
  root: string,
  prefill: EssentialPrefill = {}
): Promise<{ config: GrimoireConfig; detection: Detection | null }> {
  console.log(chalk.bold("\nDetecting project tools...\n"));

  const detections = await detectTools(root);
  const config = buildMinimalConfig();

  if (detections.length === 0) {
    console.log(chalk.dim("  No tools detected. Using minimal config.\n"));
    return { config: await askEssentialPreferences(config, root, prefill), detection: null };
  }

  const byCategory = bestByCategory(detections);

  console.log(chalk.bold("  Detected tools:\n"));
  for (const cat of CATEGORY_ORDER) {
    const label = (CATEGORY_LABELS[cat] ?? cat).padEnd(14);
    const d = byCategory.get(cat);
    if (d) console.log(`    ${label} ${chalk.cyan(d.name.padEnd(16))} ${chalk.dim(`(${d.signal})`)}`);
    else console.log(`    ${label} ${chalk.dim("(none detected)")}`);
  }

  const readline = await import("node:readline/promises");
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  console.log();
  const answer = await rl.question("  Accept detected tools? (Y/n/edit) ");

  const prefillWithSurface: EssentialPrefill = { ...prefill, detectedSurface: surfaceFromDetection(byCategory.get("surface")) };

  if (answer.toLowerCase() === "n") {
    rl.close();
    console.log(chalk.dim("  Skipping tool detection.\n"));
    return { config: await askEssentialPreferences(config, root, prefillWithSurface), detection: null };
  }

  if (answer.toLowerCase() === "edit") await editDetections(rl, byCategory);
  rl.close();

  applyProjectDetections(config, byCategory);
  applyLlmFallbacks(config, byCategory);

  return { config: await askEssentialPreferences(config, root, prefillWithSurface), detection: byCategory.get("language") ?? null };
}

const PROMPT_SURFACES: readonly ProjectSurface[] = [
  "tui",
  "web",
  "mobile",
  "api",
  "mixed",
];

function surfaceFromDetection(
  d: Detection | undefined
): ProjectSurface | undefined {
  if (!d) return undefined;
  return PROMPT_SURFACES.includes(d.name as ProjectSurface)
    ? (d.name as ProjectSurface)
    : undefined;
}

async function editDetections(
  rl: import("node:readline/promises").Interface,
  byCategory: Map<string, Detection>
): Promise<void> {
  console.log(
    chalk.dim(
      "\n  For each tool, press Enter to accept, 'n' to skip, or type a custom name.\n"
    )
  );

  for (const cat of CATEGORY_ORDER) {
    const label = CATEGORY_LABELS[cat] ?? cat;
    const d = byCategory.get(cat);
    const current = d ? d.name : "none";
    const answer = await rl.question(`    ${label} [${current}]: `);
    const trimmed = answer.trim();
    if (trimmed.toLowerCase() === "n") {
      byCategory.delete(cat);
    } else if (trimmed && trimmed !== current) {
      byCategory.set(cat, {
        category: cat,
        name: trimmed,
        confidence: "low",
        signal: "user input",
      });
    }
  }
}

async function askEssentialPreferences(
  config: GrimoireConfig,
  root: string,
  prefill: EssentialPrefill = {}
): Promise<GrimoireConfig> {
  const readline = await import("node:readline/promises");
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  // 1. AI agents
  console.log(chalk.bold("\n  AI agents:\n"));
  console.log(chalk.dim("    Which AI coding tools will use these skills?"));
  console.log(
    chalk.dim(
      "    Skills install per tool: claude→.claude/skills, opencode→.opencode/skills, codex→.agents/skills."
    )
  );
  console.log(
    chalk.dim("    cursor/copilot use AGENTS.md-derived files (no skills).\n")
  );

  const detectedAgents = await detectAgentFiles(root).catch(
    () => [] as string[]
  );
  const defaultAgents =
    detectedAgents.length > 0 ? detectedAgents.join(",") : "claude";
  const agentsAnswer = await rl.question(
    `    AI agents (comma-separated: claude/opencode/codex/cursor/copilot) [${defaultAgents}]: `
  );
  const rawAgents = agentsAnswer.trim() || defaultAgents;
  config.project.agents = rawAgents
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  // 2. Recommended integrations
  console.log(chalk.bold("\n  Recommended integrations:\n"));
  console.log(
    chalk.dim(
      "    These are optional but recommended. Saying yes records the intent"
    )
  );
  console.log(
    chalk.dim("    in config and prints install commands at the end.\n")
  );

  const integrations: {
    codebase_memory_mcp?: boolean;
    caveman_plugin?: boolean;
  } = {};

  if (prefill.codebaseMemoryMcp === undefined) {
    const cbmAnswer = await rl.question(
      "    Install codebase-memory-mcp (call graphs, code intelligence)? (Y/n) "
    );
    integrations.codebase_memory_mcp =
      cbmAnswer.trim().toLowerCase() !== "n";
  } else {
    integrations.codebase_memory_mcp = prefill.codebaseMemoryMcp;
  }

  if (prefill.cavemanPlugin === undefined) {
    const cavemanPluginAnswer = await rl.question(
      "    Install caveman skill plugin (Claude Code marketplace)? (y/N) "
    );
    integrations.caveman_plugin =
      cavemanPluginAnswer.trim().toLowerCase() === "y";
  } else {
    integrations.caveman_plugin = prefill.cavemanPlugin;
  }

  config.project.integrations = integrations;

  // 3. Surface
  await askSurface(rl, config, prefill.detectedSurface);

  // 4. Caveman level
  const currentCaveman = config.project.caveman ?? "lite";
  const cavemanAnswer = await rl.question(
    `    Token optimization (caveman)? (none/lite/full/ultra) [${currentCaveman}]: `
  );
  config.project.caveman = (
    cavemanAnswer.trim() ? cavemanAnswer.trim().toLowerCase() : currentCaveman
  ) as CavemanLevel;

  // 5. Commit style
  const commitAnswer = await rl.question(
    `    Commit style? (conventional/angular/custom) [${config.project.commit_style}]: `
  );
  if (commitAnswer.trim()) {
    config.project.commit_style = commitAnswer.trim();
  }

  // 6. Design tool + brand capture
  await runSections(rl, config, root, ["design"]);

  rl.close();
  console.log();
  return config;
}

async function askSurface(
  rl: import("node:readline/promises").Interface,
  config: GrimoireConfig,
  detected: ProjectSurface | undefined
): Promise<void> {
  const prompt = detected
    ? `    Project surface: ${detected} — confirm or override (tui/web/mobile/api/mixed/Enter to accept): `
    : `    Project surface? (tui/web/mobile/api/mixed/skip) `;
  const answer = (await rl.question(prompt)).trim().toLowerCase();
  if (!answer) {
    if (detected) config.project.surface = detected;
    return;
  }
  if (answer === "skip") return;
  if (PROMPT_SURFACES.includes(answer as ProjectSurface)) {
    config.project.surface = answer as ProjectSurface;
  }
}

function confidenceRank(c: "high" | "medium" | "low"): number {
  return c === "high" ? 3 : c === "medium" ? 2 : 1;
}

async function setupAgentsFile(
  root: string,
  caveman: CavemanLevel
): Promise<void> {
  await upsertAgentsFile(root, PACKAGE_ROOT, "created", caveman);
}

async function installSkills(root: string, agents: string[]): Promise<void> {
  await installSkillFiles(root, PACKAGE_ROOT, SKILL_NAMES, "created", agents);
}
