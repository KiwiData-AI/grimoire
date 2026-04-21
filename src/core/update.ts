import { readFile, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as yamlParse, stringify as yamlStringify } from "yaml";
import chalk from "chalk";
import { fileExists } from "../utils/fs.js";
import { loadConfig, CURRENT_CONFIG_VERSION } from "../utils/config.js";
import {
  upsertAgentsFile,
  installSkillFiles,
  installTemplates,
  ensureDirectories,
  generateAgentFiles,
  detectAgentFiles,
  SKILL_NAMES,
} from "./shared-setup.js";
import { setupHooks } from "./hooks.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = join(__dirname, "..", "..");

export interface UpdateOptions {
  skipAgents: boolean;
  skipSkills: boolean;
  skipHooks: boolean;
  skipTemplates: boolean;
  forceTemplates: boolean;
  skipConfig: boolean;
}

export async function updateProject(
  projectPath: string,
  options: UpdateOptions
): Promise<void> {
  const root = join(process.cwd(), projectPath);

  // Verify this is a grimoire project
  if (!(await fileExists(join(root, ".grimoire")))) {
    throw new Error("No .grimoire/ directory found. Run grimoire init first.");
  }

  console.log(chalk.bold("Updating grimoire...\n"));

  // 1. Migrate config if needed
  if (!options.skipConfig) {
    await migrateConfig(root);
  }

  // 2. Ensure all directories exist
  await ensureDirectories(root);

  // 3. Update templates (create missing, optionally force-overwrite)
  if (!options.skipTemplates) {
    await installTemplates(root, PACKAGE_ROOT, options.forceTemplates);
  }

  // 4. Update AGENTS.md
  if (!options.skipAgents) {
    await updateAgentsFile(root);
  }

  // 5. Determine agents from config (fallback to auto-detect for legacy projects)
  const config = await loadConfig(root);
  const configAgents = config.project.agents ?? [];
  const agents = configAgents.length > 0 ? configAgents : await detectAgentFiles(root);
  const instructionAgents = agents.filter((a) => ["cursor", "copilot"].includes(a));
  const skillAgents = agents.filter((a) => ["claude", "opencode", "codex"].includes(a));

  // 6. Update agent-specific instruction files (cursor, copilot)
  if (!options.skipAgents && instructionAgents.length > 0) {
    await generateAgentFiles(root, PACKAGE_ROOT, instructionAgents, "updated");
  }

  // 7. Update skills (install to every selected agent's skill dir)
  if (!options.skipSkills) {
    const targets = skillAgents.length > 0 ? skillAgents : ["claude"];
    await updateSkills(root, targets);
  }

  // 8. Update hooks
  if (!options.skipHooks) {
    await setupHooks(root);
  }

  // 9. Write version stamp
  await writeVersionStamp(root);

  console.log(`\n${chalk.bold.green("Done!")} Grimoire updated.`);
}

async function updateAgentsFile(root: string): Promise<void> {
  const config = await loadConfig(root);
  const caveman = config.project.caveman ?? "none";
  await upsertAgentsFile(root, PACKAGE_ROOT, "updated", caveman);
}

async function updateSkills(root: string, agents: string[]): Promise<void> {
  await installSkillFiles(root, PACKAGE_ROOT, SKILL_NAMES, "updated", agents);
}

/**
 * Migrate config.yaml to the current schema version.
 * Additive only — never removes user keys.
 */
async function migrateConfig(root: string): Promise<void> {
  const configPath = join(root, ".grimoire", "config.yaml");

  if (!(await fileExists(configPath))) {
    console.log(`  ${chalk.yellow("skipped")} config migration (no config.yaml)`);
    return;
  }

  const content = await readFile(configPath, "utf-8");
  let raw: Record<string, unknown>;
  try {
    raw = (yamlParse(content) as Record<string, unknown>) ?? {};
  } catch {
    console.log(`  ${chalk.yellow("skipped")} config migration (invalid YAML)`);
    return;
  }

  const currentVersion = Number(raw.version ?? 1);
  if (currentVersion >= CURRENT_CONFIG_VERSION) {
    return; // already up to date
  }

  // Apply migrations in order
  for (const migration of MIGRATIONS) {
    if (currentVersion <= migration.from) {
      migration.apply(raw);
    }
  }

  raw.version = CURRENT_CONFIG_VERSION;
  await writeFile(configPath, yamlStringify(raw));
  console.log(
    `  ${chalk.blue("migrated")} config.yaml (v${currentVersion} → v${CURRENT_CONFIG_VERSION})`
  );
}

interface Migration {
  from: number;
  to: number;
  apply: (raw: Record<string, unknown>) => void;
}

function ensureChecks(raw: Record<string, unknown>, required: string[]): void {
  if (!Array.isArray(raw.checks)) return;
  const checks = raw.checks as string[];
  for (const check of required) {
    if (!checks.includes(check)) {
      checks.push(check);
    }
  }
}

function upgradeFlatlLlm(raw: Record<string, unknown>): void {
  if (!raw.llm || typeof raw.llm !== "object") return;
  const llm = raw.llm as Record<string, unknown>;
  if (!llm.thinking && llm.command) {
    const cmd = String(llm.command);
    llm.thinking = { command: cmd };
    llm.coding = { command: cmd };
    delete llm.command;
  }
}

const MIGRATIONS: Migration[] = [
  {
    from: 1,
    to: 2,
    apply: (raw) => {
      if (!raw.project || typeof raw.project !== "object") {
        raw.project = {};
      }
      const project = raw.project as Record<string, unknown>;
      if (!project.caveman) {
        project.caveman = "lite";
      }
      ensureChecks(raw, ["dep_audit", "secrets", "best_practices"]);
      upgradeFlatlLlm(raw);
    },
  },
];

/**
 * Write a version stamp so future updates know what version was last installed.
 */
async function writeVersionStamp(root: string): Promise<void> {
  try {
    const pkgJson = await readFile(join(PACKAGE_ROOT, "package.json"), "utf-8");
    const pkg = JSON.parse(pkgJson) as { version: string };
    const stampPath = join(root, ".grimoire", ".version");
    await writeFile(stampPath, pkg.version + "\n");
  } catch {
    // Non-critical — don't fail the update
  }
}
