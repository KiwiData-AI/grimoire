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
  BugTrackerConfig,
  TestingToolConfig,
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

const __dirname = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = join(__dirname, "..", "..");

interface InitOptions {
  skipAgents: boolean;
  skipSkills: boolean;
  noDetect: boolean;
  agents: string[];
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

export async function initProject(
  projectPath: string,
  options: InitOptions
): Promise<void> {
  const root = join(process.cwd(), projectPath);

  console.log(chalk.bold("Initializing grimoire...\n"));

  // Create directory structure
  for (const dir of GRIMOIRE_DIRS) {
    const fullPath = join(root, dir);
    await mkdir(fullPath, { recursive: true });
    console.log(`  ${chalk.green("created")} ${dir}/`);
  }

  // Copy template files
  for (const [src, dest] of TEMPLATE_FILES) {
    const srcPath = join(PACKAGE_ROOT, "templates", src);
    const destPath = join(root, dest);
    if (!(await fileExists(destPath))) {
      await copyFile(srcPath, destPath);
      console.log(`  ${chalk.green("created")} ${dest}`);
    } else {
      console.log(`  ${chalk.yellow("exists")}  ${dest}`);
    }
  }

  // Generate config.yaml with optional tool detection
  const configPath = join(root, ".grimoire", "config.yaml");
  let cavemanLevel: CavemanLevel = "lite";
  let configAgents: string[] = [];
  let integrationFlags = {
    codebaseMemoryMcp: options.installCodebaseMemoryMcp,
    cavemanPlugin: options.installCavemanPlugin,
  };
  if (!(await fileExists(configPath))) {
    const config = options.noDetect
      ? buildMinimalConfig()
      : await buildDetectedConfig(root, integrationFlags);
    cavemanLevel = config.project.caveman ?? "lite";
    configAgents = config.project.agents ?? [];
    integrationFlags = {
      codebaseMemoryMcp:
        integrationFlags.codebaseMemoryMcp ??
        config.project.integrations?.codebase_memory_mcp,
      cavemanPlugin:
        integrationFlags.cavemanPlugin ??
        config.project.integrations?.caveman_plugin,
    };
    await writeFile(configPath, yamlStringify(config));
    console.log(`  ${chalk.green("created")} .grimoire/config.yaml`);
  } else {
    console.log(`  ${chalk.yellow("exists")}  .grimoire/config.yaml`);
    // Read existing config to get caveman level + agents
    const { loadConfig } = await import("../utils/config.js");
    const existing = await loadConfig(root);
    cavemanLevel = existing.project.caveman ?? "none";
    configAgents = existing.project.agents ?? [];
    integrationFlags = {
      codebaseMemoryMcp:
        integrationFlags.codebaseMemoryMcp ??
        existing.project.integrations?.codebase_memory_mcp,
      cavemanPlugin:
        integrationFlags.cavemanPlugin ??
        existing.project.integrations?.caveman_plugin,
    };
  }

  // Merge agents from config + CLI flag (--agent). De-dup.
  const allAgents = Array.from(new Set([...configAgents, ...options.agents]));
  const SKILL_SUPPORTED = ["claude", "opencode", "codex"];
  const INSTRUCTION_SUPPORTED = ["cursor", "copilot"];
  const skillAgents = allAgents.filter((a) => SKILL_SUPPORTED.includes(a));
  const instructionAgents = allAgents.filter((a) => INSTRUCTION_SUPPORTED.includes(a));
  for (const a of allAgents) {
    if (!SKILL_SUPPORTED.includes(a) && !INSTRUCTION_SUPPORTED.includes(a)) {
      console.log(
        `  ${chalk.yellow("unknown")} agent type: ${a} (supported: ${[...SKILL_SUPPORTED, ...INSTRUCTION_SUPPORTED].join(", ")})`
      );
    }
  }

  // Generate AGENTS.md (or append grimoire section)
  if (!options.skipAgents) {
    await setupAgentsFile(root, cavemanLevel);
  }

  // Install skills to each selected agent's skill directory
  if (!options.skipSkills) {
    const targets = skillAgents.length > 0 ? skillAgents : ["claude"];
    await installSkills(root, targets);
  }

  // Generate agent-specific instruction files (cursor, copilot)
  if (instructionAgents.length > 0) {
    await generateAgentFiles(root, PACKAGE_ROOT, instructionAgents, "created");
  }

  // Set up hooks (Claude Code + git)
  if (!options.skipAgents) {
    await setupHooks(root);
  }

  console.log(
    `\n${chalk.bold.green("Done!")} Grimoire initialized.\n`
  );
  console.log("Directory structure:");
  console.log("  features/              Gherkin feature files (behavioral specs)");
  console.log("  .grimoire/decisions/   MADR decision records (architectural specs)");
  console.log("  .grimoire/docs/        Project docs, data schema, and context");
  console.log("  .grimoire/changes/     Changes in progress");
  console.log("  .grimoire/archive/     Completed changes\n");
  console.log("Next steps:");
  console.log("  Edit .grimoire/docs/context.yml to describe your deployment,");
  console.log("  related services, and infrastructure.\n");

  printIntegrationInstructions(integrationFlags);
}

function printIntegrationInstructions(flags: {
  codebaseMemoryMcp?: boolean;
  cavemanPlugin?: boolean;
}): void {
  if (!flags.codebaseMemoryMcp && !flags.cavemanPlugin) return;

  console.log(chalk.bold("Recommended integrations to install:\n"));

  if (flags.codebaseMemoryMcp) {
    console.log(
      `  ${chalk.cyan("codebase-memory-mcp")} — call graphs, dead-code detection, cross-service routes`
    );
    console.log(
      "    macOS / Linux:"
    );
    console.log(
      `      ${chalk.dim("curl -fsSL https://raw.githubusercontent.com/DeusData/codebase-memory-mcp/main/install.sh | bash")}`
    );
    console.log(
      "    Windows (PowerShell):"
    );
    console.log(
      `      ${chalk.dim("Invoke-WebRequest https://raw.githubusercontent.com/DeusData/codebase-memory-mcp/main/install.ps1 -OutFile install.ps1; .\\install.ps1")}`
    );
    console.log(
      `    Restart your agent, then say "Index this project".\n`
    );
  }

  if (flags.cavemanPlugin) {
    console.log(
      `  ${chalk.cyan("caveman skill plugin")} — token-efficient response style for Claude Code`
    );
    console.log("    In Claude Code:");
    console.log(`      ${chalk.dim("/plugin marketplace add JuliusBrussee/caveman")}`);
    console.log(`      ${chalk.dim("/plugin install caveman@JuliusBrussee/caveman")}\n`);
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

interface IntegrationPrefill {
  codebaseMemoryMcp?: boolean;
  cavemanPlugin?: boolean;
}

async function buildDetectedConfig(
  root: string,
  prefill: IntegrationPrefill = {}
): Promise<GrimoireConfig> {
  console.log(chalk.bold("\nDetecting project tools...\n"));

  const detections = await detectTools(root);
  const config = buildMinimalConfig();

  if (detections.length === 0) {
    console.log(chalk.dim("  No tools detected. Using minimal config.\n"));
    return await askPreferences(config, root, prefill);
  }

  // Group detections by category and pick highest confidence per category
  const byCategory = new Map<string, Detection>();
  for (const d of detections) {
    const existing = byCategory.get(d.category);
    if (
      !existing ||
      confidenceRank(d.confidence) > confidenceRank(existing.confidence)
    ) {
      byCategory.set(d.category, d);
    }
  }

  // Display detections
  console.log(chalk.bold("  Detected tools:\n"));
  for (const cat of CATEGORY_ORDER) {
    const label = (CATEGORY_LABELS[cat] ?? cat).padEnd(14);
    const d = byCategory.get(cat);
    if (d) {
      console.log(
        `    ${label} ${chalk.cyan(d.name.padEnd(16))} ${chalk.dim(`(${d.signal})`)}`
      );
    } else {
      console.log(`    ${label} ${chalk.dim("(none detected)")}`);
    }
  }

  // Ask for confirmation
  const readline = await import("node:readline/promises");
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log();
  const answer = await rl.question(
    "  Accept detected tools? (Y/n/edit) "
  );

  if (answer.toLowerCase() === "n") {
    rl.close();
    console.log(chalk.dim("  Skipping tool detection.\n"));
    return await askPreferences(config, root, prefill);
  }

  if (answer.toLowerCase() === "edit") {
    await editDetections(rl, byCategory);
  }

  rl.close();

  // Set project-level detections
  const langDetection = byCategory.get("language");
  if (langDetection) {
    config.project.language = langDetection.name;
  }
  const pkgMgrDetection = byCategory.get("package_manager");
  if (pkgMgrDetection) {
    config.project.package_manager = pkgMgrDetection.name;
  }
  const docToolDetection = byCategory.get("doc_tool");
  if (docToolDetection) {
    config.project.doc_tool = docToolDetection.name;
  }
  const commentStyleDetection = byCategory.get("comment_style");
  if (commentStyleDetection) {
    config.project.comment_style = commentStyleDetection.name;
  }

  // Build tools from confirmed detections (skip project-level categories)
  const projectCategories = new Set([
    "language",
    "package_manager",
    "doc_tool",
    "comment_style",
  ]);
  for (const [category, detection] of byCategory) {
    if (projectCategories.has(category)) continue;
    const tool: ToolConfig = { name: detection.name };
    if (detection.command) tool.command = detection.command;
    if (detection.check_command) tool.check_command = detection.check_command;
    config.tools[category] = tool;
  }

  // Add LLM-based steps if no dedicated security tool was detected
  if (!byCategory.has("security")) {
    config.tools.security = {
      name: "llm",
      prompt:
        "Review these changed files for security vulnerabilities. Tag each finding with OWASP Top 10 category and CWE ID. Check for: SQL injection (CWE-89), XSS (CWE-79), broken auth (CWE-287), insecure crypto (CWE-327), SSRF (CWE-918), path traversal (CWE-22), insecure deserialization (CWE-502), missing access control (CWE-862), CSRF (CWE-352), hardcoded secrets (CWE-798).",
    };
  }

  // Add LLM-based dep audit if no dedicated tool was detected
  if (!byCategory.has("dep_audit")) {
    config.tools.dep_audit = {
      name: "llm",
      prompt:
        "Review these changed files for newly added dependencies or imports. Flag potential typosquatting (CWE-1357), packages you cannot verify as real, and packages with known security advisories. Check for misspellings (e.g., 'reqeusts' instead of 'requests').",
    };
  }

  // Add LLM-based secret scanning if no dedicated tool was detected
  if (!byCategory.has("secrets")) {
    config.tools.secrets = {
      name: "llm",
      prompt:
        "Review these changed files for hardcoded secrets (CWE-798), API keys, passwords, tokens, private keys, or credentials (CWE-312). Flag any string that looks like a secret value rather than a placeholder or environment variable reference.",
    };
  }

  // Add LLM-based dead code detection if no dedicated tool was detected
  if (!byCategory.has("dead_code")) {
    config.tools.dead_code = {
      name: "llm",
      prompt:
        "Review these changed files for dead code: unused functions, unreachable branches, unused imports, unused variables, and exports that are never imported elsewhere. Only flag code that is clearly dead, not code that might be used dynamically.",
    };
  }

  config.tools.best_practices = {
    name: "llm",
    prompt: "Review these changed files for best practices violations",
  };

  // Add jscpd for duplicates if not already set
  if (!config.tools.duplicates) {
    config.tools.duplicates = {
      name: "jscpd",
      command: "npx jscpd --reporters console",
    };
  }

  return await askPreferences(config, root);
}

async function editDetections(
  rl: import("node:readline/promises").Interface,
  byCategory: Map<string, Detection>
): Promise<void> {
  console.log(
    chalk.dim("\n  For each tool, press Enter to accept, 'n' to skip, or type a custom name.\n")
  );

  for (const cat of CATEGORY_ORDER) {
    const label = CATEGORY_LABELS[cat] ?? cat;
    const d = byCategory.get(cat);
    const current = d ? d.name : "none";

    const answer = await rl.question(
      `    ${label} [${current}]: `
    );

    const trimmed = answer.trim();
    if (trimmed.toLowerCase() === "n") {
      byCategory.delete(cat);
    } else if (trimmed && trimmed !== current) {
      // User typed a custom name — create a detection with low confidence
      byCategory.set(cat, {
        category: cat,
        name: trimmed,
        confidence: "low",
        signal: "user input",
      });
    }
    // else: accept current (no change)
  }
}

async function askPreferences(
  config: GrimoireConfig,
  root: string,
  prefill: IntegrationPrefill = {}
): Promise<GrimoireConfig> {
  const readline = await import("node:readline/promises");
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log(chalk.bold("\n  AI agents:\n"));
  console.log(chalk.dim("    Which AI coding tools will use these skills?"));
  console.log(chalk.dim("    Skills install per tool: claude→.claude/skills, opencode→.opencode/skills, codex→.agents/skills."));
  console.log(chalk.dim("    cursor/copilot use AGENTS.md-derived files (no skills).\n"));

  const detectedAgents = await detectAgentFiles(root).catch(() => [] as string[]);
  const defaultAgents = detectedAgents.length > 0 ? detectedAgents.join(",") : "claude";
  const agentsAnswer = await rl.question(
    `    AI agents (comma-separated: claude/opencode/codex/cursor/copilot) [${defaultAgents}]: `
  );
  const rawAgents = agentsAnswer.trim() || defaultAgents;
  const agents = rawAgents
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  config.project.agents = agents;

  // Recommended integrations
  console.log(chalk.bold("\n  Recommended integrations:\n"));
  console.log(
    chalk.dim("    These are optional but recommended. Saying yes records the")
  );
  console.log(
    chalk.dim("    intent in config and prints install commands at the end.\n")
  );

  const integrations: { codebase_memory_mcp?: boolean; caveman_plugin?: boolean } = {};

  if (prefill.codebaseMemoryMcp === undefined) {
    const cbmAnswer = await rl.question(
      "    Install codebase-memory-mcp (call graphs, code intelligence)? (Y/n) "
    );
    integrations.codebase_memory_mcp = cbmAnswer.trim().toLowerCase() !== "n";
  } else {
    integrations.codebase_memory_mcp = prefill.codebaseMemoryMcp;
  }

  if (prefill.cavemanPlugin === undefined) {
    const cavemanPluginAnswer = await rl.question(
      "    Install caveman skill plugin (Claude Code marketplace)? (y/N) "
    );
    integrations.caveman_plugin = cavemanPluginAnswer.trim().toLowerCase() === "y";
  } else {
    integrations.caveman_plugin = prefill.cavemanPlugin;
  }

  config.project.integrations = integrations;

  console.log(chalk.bold("\n  Project preferences:\n"));

  const currentCaveman = config.project.caveman ?? "lite";
  const cavemanAnswer = await rl.question(
    `    Token optimization (caveman)? (none/lite/full/ultra) [${currentCaveman}]: `
  );
  if (cavemanAnswer.trim()) {
    const level = cavemanAnswer.trim().toLowerCase();
    config.project.caveman = (level === "none" ? "none" : level) as CavemanLevel;
  } else {
    config.project.caveman = currentCaveman;
  }

  const commitAnswer = await rl.question(
    `    Commit style? (conventional/angular/custom) [${config.project.commit_style}]: `
  );
  if (commitAnswer.trim()) {
    config.project.commit_style = commitAnswer.trim();
  }

  const currentDocTool = config.project.doc_tool ?? "none";
  const docToolAnswer = await rl.question(
    `    Doc generator? (sphinx/mkdocs/typedoc/jsdoc/none) [${currentDocTool}]: `
  );
  if (docToolAnswer.trim()) {
    config.project.doc_tool =
      docToolAnswer.trim() === "none" ? undefined : docToolAnswer.trim();
  }

  const currentCommentStyle = config.project.comment_style ?? "none";
  const commentAnswer = await rl.question(
    `    Comment/docstring style? (google/numpy/sphinx/jsdoc/tsdoc/none) [${currentCommentStyle}]: `
  );
  if (commentAnswer.trim()) {
    config.project.comment_style =
      commentAnswer.trim() === "none" ? undefined : commentAnswer.trim();
  }

  // Design tool preferences
  console.log(chalk.bold("\n  Front-end design:\n"));
  console.log(chalk.dim("    Where do UI/UX designs live? This helps grimoire reference"));
  console.log(chalk.dim("    designs during requirements elicitation.\n"));

  const designToolAnswer = await rl.question(
    `    Design tool? (figma/storybook/sketch/zeplin/none) [none]: `
  );
  const designTool = designToolAnswer.trim().toLowerCase();
  if (designTool && designTool !== "none") {
    const designPathAnswer = await rl.question(
      `    Local design assets path? (e.g., designs/, docs/wireframes/) [none]: `
    );
    const designUrlAnswer = await rl.question(
      `    Design project URL? (e.g., Figma project link) [none]: `
    );
    config.project.design_tool = {
      name: designTool,
      path: designPathAnswer.trim() && designPathAnswer.trim() !== "none"
        ? designPathAnswer.trim()
        : undefined,
      url: designUrlAnswer.trim() && designUrlAnswer.trim() !== "none"
        ? designUrlAnswer.trim()
        : undefined,
    };
  }

  // LLM agent preferences
  console.log(chalk.bold("\n  AI agent preferences:\n"));

  const currentThinkCmd = config.llm.thinking.command;
  const thinkAnswer = await rl.question(
    `    Thinking agent (planning, review)? (claude/codex/cursor/custom) [${currentThinkCmd}]: `
  );
  if (thinkAnswer.trim()) {
    config.llm.thinking.command = thinkAnswer.trim();
  }
  const currentThinkModel = config.llm.thinking.model ?? "default";
  const thinkModelAnswer = await rl.question(
    `    Thinking model? (opus/sonnet/o3/auto) [${currentThinkModel}]: `
  );
  if (thinkModelAnswer.trim() && thinkModelAnswer.trim() !== "default") {
    config.llm.thinking.model =
      thinkModelAnswer.trim() === "auto" ? undefined : thinkModelAnswer.trim();
  }

  const currentCodeCmd = config.llm.coding.command;
  const codeAnswer = await rl.question(
    `    Coding agent (apply, implement)? (claude/codex/cursor/custom) [${currentCodeCmd}]: `
  );
  if (codeAnswer.trim()) {
    config.llm.coding.command = codeAnswer.trim();
  }
  const currentCodeModel = config.llm.coding.model ?? "default";
  const codeModelAnswer = await rl.question(
    `    Coding model? (sonnet/opus/gpt-4.1/auto) [${currentCodeModel}]: `
  );
  if (codeModelAnswer.trim() && codeModelAnswer.trim() !== "default") {
    config.llm.coding.model =
      codeModelAnswer.trim() === "auto" ? undefined : codeModelAnswer.trim();
  }

  console.log(chalk.bold("\n  Security & compliance:\n"));

  // Compliance frameworks
  console.log(chalk.dim("    Which compliance frameworks apply to this project?"));
  console.log(chalk.dim("    Options: owasp, pci-dss, hipaa, soc2, gdpr, iso27001, or Enter to skip.\n"));

  const complianceAnswer = await rl.question(
    `    Compliance frameworks (comma-separated) [none]: `
  );
  if (complianceAnswer.trim() && complianceAnswer.trim().toLowerCase() !== "none") {
    config.project.compliance = complianceAnswer
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
  }

  // Dependency audit tool preference
  const currentDepAudit = config.tools.dep_audit?.name ?? "auto";
  const depAuditAnswer = await rl.question(
    `    Dep audit tool? (npm-audit/pip-audit/safety/yarn-audit/pnpm-audit/none/auto) [${currentDepAudit}]: `
  );
  if (depAuditAnswer.trim() && depAuditAnswer.trim() !== "auto") {
    if (depAuditAnswer.trim() === "none") {
      delete config.tools.dep_audit;
      // Remove from checks
      config.checks = config.checks.filter((c) => c !== "dep_audit");
    } else {
      const depAuditCommands: Record<string, string> = {
        "npm-audit": "npm audit --audit-level=high",
        "pip-audit": "pip-audit",
        safety: "safety check",
        "yarn-audit": "yarn audit --level high",
        "pnpm-audit": "pnpm audit --audit-level=high",
      };
      config.tools.dep_audit = {
        name: depAuditAnswer.trim(),
        check_command: depAuditCommands[depAuditAnswer.trim()] ?? depAuditAnswer.trim(),
      };
    }
  }

  // Secret scanning tool preference
  const currentSecrets = config.tools.secrets?.name ?? "auto";
  const secretsAnswer = await rl.question(
    `    Secret scanner? (detect-secrets/gitleaks/trufflehog/none/auto) [${currentSecrets}]: `
  );
  if (secretsAnswer.trim() && secretsAnswer.trim() !== "auto") {
    if (secretsAnswer.trim() === "none") {
      delete config.tools.secrets;
      // Remove from checks
      config.checks = config.checks.filter((c) => c !== "secrets");
    } else {
      const secretCommands: Record<string, string> = {
        "detect-secrets": "detect-secrets scan --baseline .secrets.baseline",
        gitleaks: "gitleaks detect --no-git",
        trufflehog: "trufflehog filesystem . --no-update",
      };
      config.tools.secrets = {
        name: secretsAnswer.trim(),
        check_command: secretCommands[secretsAnswer.trim()] ?? secretsAnswer.trim(),
      };
    }
  }

  console.log(chalk.bold("\n  Code quality tools:\n"));

  // Dead code detection tool preference
  const currentDeadCode = config.tools.dead_code?.name ?? "auto";
  const deadCodeAnswer = await rl.question(
    `    Dead code finder? (knip/ts-prune/vulture/deadcode/none/auto) [${currentDeadCode}]: `
  );
  if (deadCodeAnswer.trim() && deadCodeAnswer.trim() !== "auto") {
    if (deadCodeAnswer.trim() === "none") {
      delete config.tools.dead_code;
      config.checks = config.checks.filter((c) => c !== "dead_code");
    } else {
      const deadCodeCommands: Record<string, string> = {
        knip: "npx knip",
        "ts-prune": "npx ts-prune",
        vulture: "vulture .",
        deadcode: "deadcode ./...",
      };
      config.tools.dead_code = {
        name: deadCodeAnswer.trim(),
        command: deadCodeCommands[deadCodeAnswer.trim()] ?? deadCodeAnswer.trim(),
      };
    }
  }

  // Bug tracking & testing tools
  console.log(chalk.bold("\n  Bug tracking & testing:\n"));

  config.bug_trackers = await askBugTrackers(rl);
  config.testing_tools = await askTestingTools(rl);

  rl.close();
  console.log();
  return config;
}

const BUG_TRACKER_MCP: Record<string, { display: string; command?: string; args?: string[]; url?: string; transport?: "stdio" | "sse" | "http" }> = {
  jira: {
    display: "Atlassian (Jira + Confluence)",
    url: "https://mcp.atlassian.com/v1/sse",
    transport: "sse",
  },
  linear: {
    display: "Linear",
    url: "https://mcp.linear.app/mcp",
    transport: "http",
  },
  github: {
    display: "GitHub Issues",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-github"],
  },
};

const TESTING_TOOL_MCP: Record<string, { display: string; command: string; args: string[] }> = {
  playwright: {
    display: "Playwright",
    command: "npx",
    args: ["-y", "@playwright/mcp@latest"],
  },
};

async function askBugTrackers(
  rl: import("node:readline/promises").Interface
): Promise<BugTrackerConfig[]> {
  const trackers: BugTrackerConfig[] = [];

  console.log(chalk.dim("    Where do bug reports live? Add one or more trackers."));
  console.log(chalk.dim("    Options: jira, linear, github, other, or press Enter to skip.\n"));

  let adding = true;
  while (adding) {
    const answer = await rl.question(
      `    Bug tracker${trackers.length > 0 ? " (another, or Enter to finish)" : ""}? `
    );
    const trimmed = answer.trim().toLowerCase();

    if (!trimmed) {
      adding = false;
      continue;
    }

    const known = BUG_TRACKER_MCP[trimmed];
    const tracker: BugTrackerConfig = { name: trimmed };

    if (known) {
      const installAnswer = await rl.question(
        `    Install ${known.display} MCP server? (Y/n) `
      );
      if (installAnswer.trim().toLowerCase() !== "n") {
        tracker.mcp = {
          name: known.display.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
          command: known.command,
          args: known.args,
          url: known.url,
          transport: known.transport,
        };
        console.log(chalk.green(`    ✓ ${known.display} MCP configured`));
      }
    }

    trackers.push(tracker);
  }

  return trackers;
}

async function askTestingTools(
  rl: import("node:readline/promises").Interface
): Promise<TestingToolConfig[]> {
  const tools: TestingToolConfig[] = [];

  console.log(chalk.dim("\n    What testing tools do your testers use? Add one or more."));
  console.log(chalk.dim("    Options: playwright, cypress, selenium, postman, other, or Enter to skip.\n"));

  let adding = true;
  while (adding) {
    const answer = await rl.question(
      `    Testing tool${tools.length > 0 ? " (another, or Enter to finish)" : ""}? `
    );
    const trimmed = answer.trim().toLowerCase();

    if (!trimmed) {
      adding = false;
      continue;
    }

    const purposeAnswer = await rl.question(
      `    Purpose? (e2e/integration/performance/api/general) [general]: `
    );
    const purpose = purposeAnswer.trim().toLowerCase() || "general";

    const tool: TestingToolConfig = { name: trimmed, purpose };
    const known = TESTING_TOOL_MCP[trimmed];

    if (known) {
      const installAnswer = await rl.question(
        `    Install ${known.display} MCP server? (Y/n) `
      );
      if (installAnswer.trim().toLowerCase() !== "n") {
        tool.mcp = {
          name: trimmed,
          command: known.command,
          args: known.args,
        };
        console.log(chalk.green(`    ✓ ${known.display} MCP configured`));
      }
    }

    tools.push(tool);
  }

  return tools;
}

function confidenceRank(c: "high" | "medium" | "low"): number {
  return c === "high" ? 3 : c === "medium" ? 2 : 1;
}

async function setupAgentsFile(root: string, caveman: CavemanLevel): Promise<void> {
  await upsertAgentsFile(root, PACKAGE_ROOT, "created", caveman);
}

async function installSkills(root: string, agents: string[]): Promise<void> {
  await installSkillFiles(root, PACKAGE_ROOT, SKILL_NAMES, "created", agents);
}

