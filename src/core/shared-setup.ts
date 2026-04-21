import { readFile, writeFile, copyFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import chalk from "chalk";
import { fileExists, escapeRegex } from "../utils/fs.js";
import type { CavemanLevel } from "../utils/config.js";

export const GRIMOIRE_START_MARKER = "<!-- GRIMOIRE:START -->";
export const GRIMOIRE_END_MARKER = "<!-- GRIMOIRE:END -->";

export const GRIMOIRE_DIRS = [
  "features",
  ".grimoire/decisions",
  ".grimoire/docs",
  ".grimoire/changes",
  ".grimoire/archive",
  ".grimoire/bugs",
];

export const TEMPLATE_FILES: Array<[string, string]> = [
  ["decision.md", ".grimoire/decisions/template.md"],
  ["context.yml", ".grimoire/docs/context.yml"],
  ["debt-exceptions.yml", ".grimoire/debt-exceptions.yml"],
  ["mapignore", ".grimoire/mapignore"],
  ["mapkeys", ".grimoire/mapkeys"],
  ["dupignore", ".grimoire/dupignore"],
];

export const SKILL_AGENTS: Record<string, string> = {
  claude: ".claude/skills",
  opencode: ".opencode/skills",
  codex: ".agents/skills",
};

export const DEFAULT_SKILL_AGENT = "claude";

export const SKILL_NAMES = [
  "grimoire-draft",
  "grimoire-plan",
  "grimoire-apply",
  "grimoire-verify",
  "grimoire-audit",
  "grimoire-remove",
  "grimoire-discover",
  "grimoire-review",
  "grimoire-bug",
  "grimoire-bug-report",
  "grimoire-bug-triage",
  "grimoire-bug-explore",
  "grimoire-bug-session",
  "grimoire-commit",
  "grimoire-pr",
  "grimoire-pr-review",
  "grimoire-refactor",
  "grimoire-branch-guard",
];

/**
 * Build a managed block from the package AGENTS.md content.
 */
export function buildManagedBlock(content: string): string {
  return `${GRIMOIRE_START_MARKER}\n${content}\n${GRIMOIRE_END_MARKER}`;
}

/**
 * Upsert grimoire-managed content into a file using start/end markers.
 * If the file exists with markers, replace the managed section.
 * If the file exists without markers, append the managed section.
 * If the file doesn't exist, create it with the managed section.
 */
export async function upsertManagedBlock(
  filePath: string,
  managedBlock: string,
  verb: "created" | "updated",
  label: string
): Promise<void> {
  if (await fileExists(filePath)) {
    const existing = await readFile(filePath, "utf-8");

    if (existing.includes(GRIMOIRE_START_MARKER)) {
      const updated = existing.replace(
        new RegExp(
          `${escapeRegex(GRIMOIRE_START_MARKER)}[\\s\\S]*?${escapeRegex(GRIMOIRE_END_MARKER)}`
        ),
        managedBlock
      );
      await writeFile(filePath, updated);
      console.log(`  ${chalk.blue("updated")} ${label} (grimoire section)`);
    } else {
      await writeFile(filePath, existing + "\n\n" + managedBlock + "\n");
      console.log(`  ${chalk.blue("appended")} ${label} (grimoire section)`);
    }
  } else {
    await writeFile(filePath, managedBlock + "\n");
    console.log(`  ${chalk.green("created")} ${label}`);
  }
}

/**
 * Build a caveman directive block for the given intensity level.
 * Uses the upstream caveman skill format (github.com/JuliusBrussee/caveman).
 */
export function buildCavemanDirective(level: CavemanLevel): string {
  if (level === "none") return "";

  const lines = [
    "## Caveman Mode",
    "",
    `Respond terse like smart caveman at **${level}** intensity. All technical substance stay. Only fluff die.`,
    "",
  ];

  if (level === "lite") {
    lines.push(
      "Rules: No filler/hedging. Keep articles + full sentences. Professional but tight.",
    );
  } else if (level === "full") {
    lines.push(
      "Rules: Drop articles (a/an/the), filler, pleasantries, hedging. Fragments OK. Short synonyms. Technical terms exact. Code blocks unchanged.",
    );
  } else if (level === "ultra") {
    lines.push(
      "Rules: Abbreviate (DB/auth/config/req/res/fn/impl), strip conjunctions, arrows for causality (X → Y), one word when one word enough. Code blocks unchanged.",
    );
  }

  lines.push(
    "",
    "Auto-clarity exception: revert to normal for security warnings, irreversible action confirmations, and multi-step sequences where fragments risk misread.",
    "",
    "Boundaries: code, commits, PRs written normally. Stop with \"stop caveman\" or \"normal mode\".",
    "",
    `<!-- caveman:${level} — based on github.com/JuliusBrussee/caveman -->`,
    "",
  );

  return lines.join("\n");
}

/**
 * Read the package AGENTS.md and upsert its content into the project's AGENTS.md.
 */
export async function upsertAgentsFile(
  root: string,
  packageRoot: string,
  verb: "created" | "updated",
  caveman: CavemanLevel = "none"
): Promise<void> {
  const agentsPath = join(root, "AGENTS.md");
  const grimoireAgents = await readFile(
    join(packageRoot, "AGENTS.md"),
    "utf-8"
  );
  const cavemanBlock = buildCavemanDirective(caveman);
  const content = cavemanBlock ? cavemanBlock + grimoireAgents : grimoireAgents;
  const managedBlock = buildManagedBlock(content);
  await upsertManagedBlock(agentsPath, managedBlock, verb, "AGENTS.md");
}

/**
 * Ensure all grimoire directories exist (idempotent).
 */
export async function ensureDirectories(
  root: string,
): Promise<void> {
  for (const dir of GRIMOIRE_DIRS) {
    const fullPath = join(root, dir);
    const existed = await fileExists(fullPath);
    await mkdir(fullPath, { recursive: true });
    if (!existed) {
      console.log(`  ${chalk.green("created")} ${dir}/`);
    }
  }
}

/**
 * Copy template files from the package into the project.
 * By default only creates missing templates. With force=true, overwrites all.
 */
export async function installTemplates(
  root: string,
  packageRoot: string,
  force: boolean = false
): Promise<void> {
  for (const [src, dest] of TEMPLATE_FILES) {
    const srcPath = join(packageRoot, "templates", src);
    const destPath = join(root, dest);
    if (await fileExists(destPath)) {
      if (force) {
        await copyFile(srcPath, destPath);
        console.log(`  ${chalk.blue("replaced")} ${dest}`);
      } else {
        console.log(`  ${chalk.yellow("exists")}  ${dest}`);
      }
    } else {
      await copyFile(srcPath, destPath);
      console.log(`  ${chalk.green("created")} ${dest}`);
    }
  }
}

/**
 * Generate agent-specific instruction files (cursor, copilot).
 */
export async function generateAgentFiles(
  root: string,
  packageRoot: string,
  agents: string[],
  verb: "created" | "updated" = "created"
): Promise<void> {
  if (agents.length === 0) return;

  const grimoireAgents = await readFile(join(packageRoot, "AGENTS.md"), "utf-8");
  const managedBlock = buildManagedBlock(grimoireAgents);

  for (const agent of agents) {
    switch (agent) {
      case "cursor": {
        const rulesDir = join(root, ".cursor", "rules");
        await mkdir(rulesDir, { recursive: true });
        const mdcPath = join(rulesDir, "grimoire.mdc");
        const frontmatter =
          "---\ndescription: Grimoire spec-driven development workflow\nglobs:\nalwaysApply: true\n---\n\n";
        await writeFile(mdcPath, frontmatter + grimoireAgents);
        console.log(`  ${chalk[verb === "created" ? "green" : "blue"](verb)} .cursor/rules/grimoire.mdc`);
        break;
      }
      case "copilot": {
        const ghDir = join(root, ".github");
        await mkdir(ghDir, { recursive: true });
        const instructionsPath = join(ghDir, "copilot-instructions.md");
        await upsertManagedBlock(
          instructionsPath,
          managedBlock,
          verb,
          ".github/copilot-instructions.md"
        );
        break;
      }
      default:
        console.log(
          `  ${chalk.yellow("unknown")} agent type: ${agent} (supported: cursor, copilot)`
        );
    }
  }
}

/**
 * Auto-detect which agent files exist in the project.
 * Covers cursor, copilot (instruction files) and claude, opencode, codex (skill dirs).
 */
export async function detectAgentFiles(root: string): Promise<string[]> {
  const agents: string[] = [];
  if (await fileExists(join(root, ".cursor", "rules", "grimoire.mdc")))
    agents.push("cursor");
  if (await fileExists(join(root, ".github", "copilot-instructions.md")))
    agents.push("copilot");
  for (const [name, dir] of Object.entries(SKILL_AGENTS)) {
    if (await fileExists(join(root, dir))) agents.push(name);
  }
  return agents;
}

/**
 * Copy SKILL.md files from the package into each selected agent's skill directory.
 * Unknown agents (cursor, copilot) are ignored — they use instruction files, not skills.
 */
export async function installSkillFiles(
  root: string,
  packageRoot: string,
  skillNames: string[],
  verb: "created" | "updated",
  agents: string[] = [DEFAULT_SKILL_AGENT]
): Promise<void> {
  const sourceSkillsDir = join(packageRoot, "skills");
  const targets = agents.filter((a) => a in SKILL_AGENTS);
  if (targets.length === 0) return;

  for (const agent of targets) {
    const relDir = SKILL_AGENTS[agent];
    const skillsDir = join(root, relDir);
    for (const skill of skillNames) {
      const destDir = join(skillsDir, skill);
      await mkdir(destDir, { recursive: true });

      const src = join(sourceSkillsDir, skill, "SKILL.md");
      const dest = join(destDir, "SKILL.md");
      await copyFile(src, dest);
      const color = verb === "created" ? chalk.green : chalk.blue;
      console.log(`  ${color(verb)} ${relDir}/${skill}/SKILL.md`);
    }
  }
}
