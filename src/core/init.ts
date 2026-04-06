import { mkdir, writeFile, readFile, copyFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { stringify as yamlStringify } from "yaml";
import chalk from "chalk";
import { detectTools, type Detection } from "./detect.js";
import type { GrimoireConfig, ToolConfig, LlmConfig } from "../utils/config.js";
import { setupHooks } from "./hooks.js";
import { fileExists, escapeRegex } from "../utils/fs.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = join(__dirname, "..", "..");

interface InitOptions {
  skipAgents: boolean;
  skipSkills: boolean;
  noDetect: boolean;
  agents: string[];
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
  const dirs = [
    "features",
    ".grimoire/decisions",
    ".grimoire/docs",
    ".grimoire/changes",
    ".grimoire/archive",
  ];

  for (const dir of dirs) {
    const fullPath = join(root, dir);
    await mkdir(fullPath, { recursive: true });
    console.log(`  ${chalk.green("created")} ${dir}/`);
  }

  // Copy decision template
  const templateSrc = join(PACKAGE_ROOT, "templates", "decision.md");
  const templateDest = join(root, ".grimoire", "decisions", "template.md");
  if (!(await fileExists(templateDest))) {
    await copyFile(templateSrc, templateDest);
    console.log(`  ${chalk.green("created")} .grimoire/decisions/template.md`);
  } else {
    console.log(`  ${chalk.yellow("exists")}  .grimoire/decisions/template.md`);
  }

  // Copy project context template
  const contextSrc = join(PACKAGE_ROOT, "templates", "context.yml");
  const contextDest = join(root, ".grimoire", "docs", "context.yml");
  if (!(await fileExists(contextDest))) {
    await copyFile(contextSrc, contextDest);
    console.log(`  ${chalk.green("created")} .grimoire/docs/context.yml`);
  } else {
    console.log(`  ${chalk.yellow("exists")}  .grimoire/docs/context.yml`);
  }

  // Copy debt exceptions template
  const debtExSrc = join(PACKAGE_ROOT, "templates", "debt-exceptions.yml");
  const debtExDest = join(root, ".grimoire", "debt-exceptions.yml");
  if (!(await fileExists(debtExDest))) {
    await copyFile(debtExSrc, debtExDest);
    console.log(`  ${chalk.green("created")} .grimoire/debt-exceptions.yml`);
  } else {
    console.log(`  ${chalk.yellow("exists")}  .grimoire/debt-exceptions.yml`);
  }

  // Copy map config files
  for (const configFile of ["mapignore", "mapkeys"]) {
    const configSrc = join(PACKAGE_ROOT, "templates", configFile);
    const configDest = join(root, ".grimoire", configFile);
    if (!(await fileExists(configDest))) {
      await copyFile(configSrc, configDest);
      console.log(`  ${chalk.green("created")} .grimoire/${configFile}`);
    } else {
      console.log(`  ${chalk.yellow("exists")}  .grimoire/${configFile}`);
    }
  }

  // Generate config.yaml with optional tool detection
  const configPath = join(root, ".grimoire", "config.yaml");
  if (!(await fileExists(configPath))) {
    const config = options.noDetect
      ? buildMinimalConfig()
      : await buildDetectedConfig(root);
    await writeFile(configPath, yamlStringify(config));
    console.log(`  ${chalk.green("created")} .grimoire/config.yaml`);
  } else {
    console.log(`  ${chalk.yellow("exists")}  .grimoire/config.yaml`);
  }

  // Generate AGENTS.md (or append grimoire section)
  if (!options.skipAgents) {
    await setupAgentsFile(root);
  }

  // Install Claude Code skills
  if (!options.skipSkills) {
    await installSkills(root);
  }

  // Generate agent-specific instruction files
  if (options.agents.length > 0) {
    await generateAgentFiles(root, options.agents);
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

async function buildDetectedConfig(root: string): Promise<GrimoireConfig> {
  console.log(chalk.bold("\nDetecting project tools...\n"));

  const detections = await detectTools(root);
  const config = buildMinimalConfig();

  if (detections.length === 0) {
    console.log(chalk.dim("  No tools detected. Using minimal config.\n"));
    return await askPreferences(config);
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
    return await askPreferences(config);
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
      prompt: "Review these changed files for security vulnerabilities",
    };
  }

  // Add LLM-based dep audit if no dedicated tool was detected
  if (!byCategory.has("dep_audit")) {
    config.tools.dep_audit = {
      name: "llm",
      prompt:
        "Review these changed files for newly added dependencies or imports. Flag any packages that look suspicious, misspelled, or that you cannot verify as real published packages. Check for typosquatting (e.g., 'reqeusts' instead of 'requests').",
    };
  }

  // Add LLM-based secret scanning if no dedicated tool was detected
  if (!byCategory.has("secrets")) {
    config.tools.secrets = {
      name: "llm",
      prompt:
        "Review these changed files for hardcoded secrets, API keys, passwords, tokens, private keys, or credentials. Flag any string that looks like a secret value rather than a placeholder or environment variable reference.",
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

  return await askPreferences(config);
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

async function askPreferences(config: GrimoireConfig): Promise<GrimoireConfig> {
  const readline = await import("node:readline/promises");
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log(chalk.bold("\n  Project preferences:\n"));

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

  console.log(chalk.bold("\n  Security tools:\n"));

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

  rl.close();
  console.log();
  return config;
}

function confidenceRank(c: "high" | "medium" | "low"): number {
  return c === "high" ? 3 : c === "medium" ? 2 : 1;
}

async function setupAgentsFile(root: string): Promise<void> {
  const agentsPath = join(root, "AGENTS.md");
  const grimoireAgents = await readFile(
    join(PACKAGE_ROOT, "AGENTS.md"),
    "utf-8"
  );

  const marker = "<!-- GRIMOIRE:START -->";
  const endMarker = "<!-- GRIMOIRE:END -->";
  const managedBlock = `${marker}\n${grimoireAgents}\n${endMarker}`;

  if (await fileExists(agentsPath)) {
    const existing = await readFile(agentsPath, "utf-8");

    if (existing.includes(marker)) {
      const updated = existing.replace(
        new RegExp(`${escapeRegex(marker)}[\\s\\S]*?${escapeRegex(endMarker)}`),
        managedBlock
      );
      await writeFile(agentsPath, updated);
      console.log(`  ${chalk.blue("updated")} AGENTS.md (grimoire section)`);
    } else {
      await writeFile(agentsPath, existing + "\n\n" + managedBlock + "\n");
      console.log(`  ${chalk.blue("appended")} AGENTS.md (grimoire section)`);
    }
  } else {
    await writeFile(agentsPath, managedBlock + "\n");
    console.log(`  ${chalk.green("created")} AGENTS.md`);
  }
}

async function generateAgentFiles(root: string, agents: string[]): Promise<void> {
  const grimoireAgents = await readFile(join(PACKAGE_ROOT, "AGENTS.md"), "utf-8");
  const marker = "<!-- GRIMOIRE:START -->";
  const endMarker = "<!-- GRIMOIRE:END -->";
  const managedBlock = `${marker}\n${grimoireAgents}\n${endMarker}`;

  for (const agent of agents) {
    switch (agent) {
      case "cursor": {
        const rulesDir = join(root, ".cursor", "rules");
        await mkdir(rulesDir, { recursive: true });
        const mdcPath = join(rulesDir, "grimoire.mdc");
        const frontmatter = "---\ndescription: Grimoire spec-driven development workflow\nglobs:\nalwaysApply: true\n---\n\n";
        await writeFile(mdcPath, frontmatter + grimoireAgents);
        console.log(`  ${chalk.green("created")} .cursor/rules/grimoire.mdc`);
        break;
      }
      case "copilot": {
        const ghDir = join(root, ".github");
        await mkdir(ghDir, { recursive: true });
        const instructionsPath = join(ghDir, "copilot-instructions.md");
        if (await fileExists(instructionsPath)) {
          const existing = await readFile(instructionsPath, "utf-8");
          if (existing.includes(marker)) {
            const updated = existing.replace(
              new RegExp(`${escapeRegex(marker)}[\\s\\S]*?${escapeRegex(endMarker)}`),
              managedBlock
            );
            await writeFile(instructionsPath, updated);
            console.log(`  ${chalk.blue("updated")} .github/copilot-instructions.md`);
          } else {
            await writeFile(instructionsPath, existing + "\n\n" + managedBlock + "\n");
            console.log(`  ${chalk.blue("appended")} .github/copilot-instructions.md`);
          }
        } else {
          await writeFile(instructionsPath, managedBlock + "\n");
          console.log(`  ${chalk.green("created")} .github/copilot-instructions.md`);
        }
        break;
      }
      default:
        console.log(`  ${chalk.yellow("unknown")} agent type: ${agent} (supported: cursor, copilot)`);
    }
  }
}

async function installSkills(root: string): Promise<void> {
  const skillsDir = join(root, ".claude", "skills");
  const sourceSkillsDir = join(PACKAGE_ROOT, "skills");

  const skillNames = [
    "grimoire-draft",
    "grimoire-plan",
    "grimoire-apply",
    "grimoire-verify",
    "grimoire-audit",
    "grimoire-remove",
    "grimoire-discover",
    "grimoire-review",
    "grimoire-bug",
    "grimoire-commit",
    "grimoire-pr",
    "grimoire-refactor",
  ];

  for (const skill of skillNames) {
    const destDir = join(skillsDir, skill);
    await mkdir(destDir, { recursive: true });

    const src = join(sourceSkillsDir, skill, "SKILL.md");
    const dest = join(destDir, "SKILL.md");
    await copyFile(src, dest);
    console.log(`  ${chalk.green("created")} .claude/skills/${skill}/SKILL.md`);
  }
}

