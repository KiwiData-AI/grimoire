import { readFile, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as yamlParse, stringify as yamlStringify } from "yaml";
import chalk from "chalk";
import { fileExists } from "../utils/fs.js";
import {
  loadConfig,
  CURRENT_CONFIG_VERSION,
  normalizeSteLevel,
  type GrimoireConfig,
} from "../utils/config.js";
import {
  upsertAgentsFile,
  ensureClaudeAgentsImport,
  installSkillFiles,
  installTemplates,
  ensureDirectories,
  generateAgentFiles,
  detectAgentFiles,
  SKILL_NAMES,
  printStePluginInstructions,
} from "./shared-setup.js";
import { setupHooks } from "./hooks.js";
import { pydoclintTool } from "./init-config.js";

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

  if (!(await fileExists(join(root, ".grimoire")))) {
    throw new Error("No .grimoire/ directory found. Run grimoire init first.");
  }

  console.log(chalk.bold("Updating grimoire...\n"));

  await printUpgradeBanner();

  if (!options.skipConfig) {
    await migrateConfig(root);
    await ensureCommentLint(root);
    await ensureDocStyleTool(root);
  }

  await ensureDirectories(root);

  if (!options.skipTemplates) {
    await installTemplates(root, PACKAGE_ROOT, options.forceTemplates);
  }

  const config = await loadConfig(root);

  if (!options.skipAgents) {
    await updateAgentsFile(root, config);
  }
  const { instructionAgents, skillAgents } = await resolveTargetAgents(config, root);

  if (!options.skipAgents && instructionAgents.length > 0) {
    await generateAgentFiles(root, PACKAGE_ROOT, instructionAgents, "updated");
  }

  if (!options.skipSkills) {
    const targets = skillAgents.length > 0 ? skillAgents : ["claude"];
    await updateSkills(root, targets);
  }

  if (!options.skipHooks) {
    await setupHooks(root);
  }

  await writeVersionStamp(root);

  maybePrintStePlugin(config);

  console.log(`\n${chalk.bold.green("Done!")} Grimoire updated.`);
}

async function resolveTargetAgents(
  config: Awaited<ReturnType<typeof loadConfig>>,
  root: string,
): Promise<{ instructionAgents: string[]; skillAgents: string[] }> {
  const configAgents = config.project.agents ?? [];
  const agents = configAgents.length > 0 ? configAgents : await detectAgentFiles(root);
  return {
    instructionAgents: agents.filter((a) => ["cursor", "copilot"].includes(a)),
    skillAgents: agents.filter((a) => ["claude", "opencode", "codex"].includes(a)),
  };
}

function maybePrintStePlugin(config: GrimoireConfig): void {
  if (!config.project.integrations?.ste_plugin) return;
  console.log("");
  printStePluginInstructions();
}

async function updateAgentsFile(root: string, config: GrimoireConfig): Promise<void> {
  const ste = config.project.ste ?? "off";
  await upsertAgentsFile(root, PACKAGE_ROOT, "updated", ste, config.project.comment_style);
  await ensureClaudeAgentsImport(root);
}

async function updateSkills(root: string, agents: string[]): Promise<void> {
  await installSkillFiles(root, PACKAGE_ROOT, SKILL_NAMES, "updated", agents);
}


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

  const parsedVersion = Number(raw.version ?? 1);
  const currentVersion = Number.isFinite(parsedVersion) ? parsedVersion : 1;
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

// The comment-lint hook is wired by setupHooks on every update, but it is inert
// unless project.comment_lint is set. Default existing projects to block so the
// hook actually runs; never override an explicit choice (including off).
async function ensureCommentLint(root: string): Promise<void> {
  const configPath = join(root, ".grimoire", "config.yaml");
  if (!(await fileExists(configPath))) return;

  let raw: Record<string, unknown>;
  try {
    raw = (yamlParse(await readFile(configPath, "utf-8")) as Record<string, unknown>) ?? {};
  } catch {
    return;
  }

  const project = (raw.project && typeof raw.project === "object" ? raw.project : (raw.project = {})) as Record<string, unknown>;
  if (project.comment_lint !== undefined) return;

  project.comment_lint = "block";
  await writeFile(configPath, yamlStringify(raw));
  console.log(`  ${chalk.blue("enabled")} comment linting (project.comment_lint: block)`);
}

async function ensureDocStyleTool(root: string): Promise<void> {
  const configPath = join(root, ".grimoire", "config.yaml");
  if (!(await fileExists(configPath))) return;

  let raw: Record<string, unknown>;
  try {
    raw = (yamlParse(await readFile(configPath, "utf-8")) as Record<string, unknown>) ?? {};
  } catch {
    return;
  }

  const before = yamlStringify(raw);
  const toolAdded = applyDocStyleMigration(raw);
  const after = yamlStringify(raw);
  if (after === before) return;

  await writeFile(configPath, after);
  const suffix = toolAdded ? " — pydoclint gate configured; install: pip install pydoclint" : "";
  console.log(`  ${chalk.blue("enabled")} doc_style check${suffix}`);
}

function applyDocStyleMigration(raw: Record<string, unknown>): boolean {
  ensureChecks(raw, ["doc_style"]);
  const project = (raw.project ?? {}) as Record<string, unknown>;
  const tools = (raw.tools ?? {}) as Record<string, unknown>;
  if (tools.doc_style !== undefined) return false;
  const tool = pydoclintTool(project.language as string | undefined, project.comment_style as string | undefined);
  if (!tool) return false;
  tools.doc_style = tool;
  raw.tools = tools;
  return true;
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
  {
    from: 2,
    to: 3,
    apply: (raw) => {
      if (!raw.project || typeof raw.project !== "object") {
        raw.project = {};
      }
      migrateSteKeys(raw.project as Record<string, unknown>);
    },
  },
];

function migrateSteKeys(project: Record<string, unknown>): void {
  const ste = normalizeSteLevel(project.ste) ?? normalizeSteLevel(project.caveman);
  if (ste) {
    project.ste = ste;
  } else if (project.ste !== undefined || project.caveman !== undefined) {
    delete project.ste;
    console.log(
      `  ${chalk.yellow("notice")} unrecognized response-style value — style is off; set project.ste (off/ste/caveman) to change`
    );
  }
  delete project.caveman;
  if (project.integrations && typeof project.integrations === "object") {
    const it = project.integrations as Record<string, unknown>;
    if (typeof it.caveman_plugin === "boolean" && it.ste_plugin === undefined) {
      it.ste_plugin = it.caveman_plugin;
    }
    delete it.caveman_plugin;
  }
}


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

interface PackageJson {
  name: string;
  version: string;
}

async function readPackageJson(): Promise<PackageJson | null> {
  try {
    const raw = await readFile(join(PACKAGE_ROOT, "package.json"), "utf-8");
    return JSON.parse(raw) as PackageJson;
  } catch {
    return null;
  }
}


function isNewer(a: string, b: string): boolean {
  const parse = (v: string): number[] =>
    v.replace(/[^\d.].*$/, "").split(".").map((n) => Number(n) || 0);
  const [aMajor, aMinor, aPatch] = parse(a);
  const [bMajor, bMinor, bPatch] = parse(b);
  if (aMajor !== bMajor) return aMajor > bMajor;
  if (aMinor !== bMinor) return aMinor > bMinor;
  return aPatch > bPatch;
}

async function fetchLatestVersion(name: string): Promise<string | null> {
  const url = `https://registry.npmjs.org/${name}/latest`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 1500);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { accept: "application/json" },
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { version?: string };
    return body.version ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}


async function printUpgradeBanner(): Promise<void> {
  if (process.env.GRIMOIRE_NO_UPDATE_CHECK) return;
  const pkg = await readPackageJson();
  if (!pkg?.name || !pkg.version) return;
  const latest = await fetchLatestVersion(pkg.name);
  if (!latest || !isNewer(latest, pkg.version)) return;
  console.log(
    chalk.yellow(
      `  Update available: ${pkg.version} → ${latest}. Run: npm i -g ${pkg.name}@latest\n`
    )
  );
}
