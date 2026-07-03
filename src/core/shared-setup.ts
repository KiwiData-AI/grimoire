import { readFile, writeFile, copyFile, mkdir, readdir, stat } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import chalk from "chalk";
import { fileExists, escapeRegex } from "../utils/fs.js";
import type { CavemanLevel } from "../utils/config.js";

const GRIMOIRE_START_MARKER = "<!-- GRIMOIRE:START -->";
const GRIMOIRE_END_MARKER = "<!-- GRIMOIRE:END -->";

export const GRIMOIRE_DIRS = [
  "features",
  ".grimoire/decisions",
  ".grimoire/docs",
  ".grimoire/changes",
  ".grimoire/bugs",
  ".grimoire/brand",
  ".grimoire/security/vulns",
];

export const TEMPLATE_FILES: Array<[string, string]> = [
  ["decision.md", ".grimoire/decisions/template.md"],
  ["context.yml", ".grimoire/docs/context.yml"],
  ["debt-exceptions.yml", ".grimoire/debt-exceptions.yml"],
  ["accepted-risks.yml", ".grimoire/security/accepted-risks.yml"],
  ["constraints.md", ".grimoire/docs/constraints.md"],
];

const SKILL_AGENTS: Record<string, string> = {
  claude: ".claude/skills",
  opencode: ".opencode/skills",
  codex: ".agents/skills",
};

const DEFAULT_SKILL_AGENT = "claude";

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
  "grimoire-design",
  "grimoire-design-consult",
  "grimoire-pr",
  "grimoire-pr-review",
  "grimoire-precommit-review",
  "grimoire-refactor",
  "grimoire-branch-guard",
  "grimoire-vuln-triage",
  "grimoire-vuln-remediate",
];

const SKILL_SHARED_DIRS = ["references"];


function buildManagedBlock(content: string): string {
  return `${GRIMOIRE_START_MARKER}\n${content}\n${GRIMOIRE_END_MARKER}`;
}


// Grimoire's own AGENTS.md is itself a managed file (it carries a caveman
// block between markers). When that file is shipped as the *source* content
// for a downstream project, the embedded markers must be removed first —
// otherwise the block gets wrapped again, nesting markers and leaving an
// orphaned END tag on every subsequent update.
function stripManagedBlock(content: string): string {
  const block = new RegExp(
    `\\n*${escapeRegex(GRIMOIRE_START_MARKER)}[\\s\\S]*${escapeRegex(GRIMOIRE_END_MARKER)}\\n*`
  );
  return content.replace(block, "\n");
}


async function upsertManagedBlock(
  filePath: string,
  managedBlock: string,
  verb: "created" | "updated",
  label: string
): Promise<void> {
  if (await fileExists(filePath)) {
    const existing = await readFile(filePath, "utf-8");

    if (existing.includes(GRIMOIRE_START_MARKER)) {
      // Greedy match (no `?`) spans from the first START to the *last* END so
      // a file already corrupted with duplicate END tags self-heals on update.
      const updated = existing.replace(
        new RegExp(
          `${escapeRegex(GRIMOIRE_START_MARKER)}[\\s\\S]*${escapeRegex(GRIMOIRE_END_MARKER)}`
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


const DOC_FORMAT_HINTS: Record<string, string> = {
  sphinx: "`:param x:` / `:returns:`",
  google: "`Args:` / `Returns:` sections",
  numpy: "`Parameters` / `Returns` sections",
  jsdoc: "`@param` / `@returns` tags",
  tsdoc: "`@param name` (no `{type}` braces)",
};

export function buildCommentStyleDirective(style?: string): string {
  if (!style) return "";
  const hint = DOC_FORMAT_HINTS[style];
  return [
    "## Project Comment Style",
    "",
    `Docstrings in this project use **${style}**${hint ? ` — ${hint}` : ""}. The \`doc_style\` commit gate enforces it.`,
    "",
    "",
  ].join("\n");
}


export async function upsertAgentsFile(
  root: string,
  packageRoot: string,
  verb: "created" | "updated",
  caveman: CavemanLevel = "none",
  commentStyle?: string
): Promise<void> {
  const agentsPath = join(root, "AGENTS.md");
  if (resolve(root) === resolve(packageRoot)) {
    await upsertInPlaceAgentsFile(agentsPath, verb, caveman, commentStyle);
    return;
  }
  const grimoireAgents = stripManagedBlock(
    await readFile(join(packageRoot, "AGENTS.md"), "utf-8")
  );
  const directives = buildCavemanDirective(caveman) + buildCommentStyleDirective(commentStyle);
  const content = directives ? directives + grimoireAgents : grimoireAgents;
  const managedBlock = buildManagedBlock(content);
  await upsertManagedBlock(agentsPath, managedBlock, verb, "AGENTS.md");
}

async function upsertInPlaceAgentsFile(
  agentsPath: string,
  verb: "created" | "updated",
  caveman: CavemanLevel,
  commentStyle?: string
): Promise<void> {
  const cavemanBlock = buildCavemanDirective(caveman) + buildCommentStyleDirective(commentStyle);
  if (cavemanBlock) {
    const managedBlock = buildManagedBlock(cavemanBlock);
    await upsertManagedBlock(agentsPath, managedBlock, verb, "AGENTS.md");
    return;
  }
  if (!(await fileExists(agentsPath))) {
    console.log(`  ${chalk.dim("skipped")} AGENTS.md (in-place — no caveman directive to install)`);
    return;
  }
  const existing = await readFile(agentsPath, "utf-8");
  if (!existing.includes(GRIMOIRE_START_MARKER)) {
    console.log(`  ${chalk.dim("skipped")} AGENTS.md (in-place — no caveman directive, no managed block)`);
    return;
  }
  const stripped = existing.replace(
    new RegExp(
      `\\n*${escapeRegex(GRIMOIRE_START_MARKER)}[\\s\\S]*?${escapeRegex(GRIMOIRE_END_MARKER)}\\n*`
    ),
    "\n"
  );
  await writeFile(agentsPath, stripped);
  console.log(`  ${chalk.blue(verb)} AGENTS.md (in-place — stripped stale managed block)`);
}


// Claude Code reads CLAUDE.md, not AGENTS.md; an @AGENTS.md import makes the
// grimoire instructions load in every session for both file conventions.
export async function ensureClaudeAgentsImport(root: string): Promise<void> {
  const claudePath = join(root, "CLAUDE.md");
  const importLine = "@AGENTS.md";
  if (await fileExists(claudePath)) {
    const existing = await readFile(claudePath, "utf-8");
    if (existing.includes(importLine)) return;
    await writeFile(claudePath, existing.trimEnd() + "\n\n" + importLine + "\n");
    console.log(`  ${chalk.blue("updated")} CLAUDE.md (@AGENTS.md import)`);
    return;
  }
  await writeFile(claudePath, importLine + "\n");
  console.log(`  ${chalk.green("created")} CLAUDE.md (@AGENTS.md import)`);
}


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


export async function generateAgentFiles(
  root: string,
  packageRoot: string,
  agents: string[],
  verb: "created" | "updated" = "created"
): Promise<void> {
  if (agents.length === 0) return;

  const grimoireAgents = stripManagedBlock(
    await readFile(join(packageRoot, "AGENTS.md"), "utf-8")
  );
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


async function copyDirRecursive(srcDir: string, destDir: string): Promise<string[]> {
  const copied: string[] = [];
  const walk = async (src: string, dest: string): Promise<void> => {
    const entries = await readdir(src, { withFileTypes: true });
    await mkdir(dest, { recursive: true });
    for (const entry of entries) {
      const srcPath = join(src, entry.name);
      const destPath = join(dest, entry.name);
      if (entry.isDirectory()) {
        await walk(srcPath, destPath);
      } else if (entry.isFile()) {
        await copyFile(srcPath, destPath);
        copied.push(relative(srcDir, srcPath));
      }
    }
  };
  await walk(srcDir, destDir);
  return copied;
}


async function installSkillsForAgent(
  skillsDir: string,
  relDir: string,
  skillNames: string[],
  sourceSkillsDir: string,
  color: (s: string) => string,
  verb: string,
): Promise<void> {
  for (const skill of skillNames) {
    let copied: string[];
    try {
      copied = await copyDirRecursive(join(sourceSkillsDir, skill), join(skillsDir, skill));
    } catch {
      console.log(`  ${chalk.yellow("missing")} skill source ${skill}`);
      continue;
    }
    for (const file of copied) console.log(`  ${color(verb)} ${relDir}/${skill}/${file}`);
  }
  for (const shared of SKILL_SHARED_DIRS) {
    const srcShared = join(sourceSkillsDir, shared);
    try {
      const s = await stat(srcShared);
      if (!s.isDirectory()) continue;
    } catch {
      continue;
    }
    const copied = await copyDirRecursive(srcShared, join(skillsDir, shared));
    for (const file of copied) console.log(`  ${color(verb)} ${relDir}/${shared}/${file}`);
  }
}

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

  const color = verb === "created" ? chalk.green : chalk.blue;

  for (const agent of targets) {
    const relDir = SKILL_AGENTS[agent];
    await installSkillsForAgent(join(root, relDir), relDir, skillNames, sourceSkillsDir, color, verb);
  }
}
