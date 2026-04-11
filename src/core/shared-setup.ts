import { readFile, writeFile, copyFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import chalk from "chalk";
import { fileExists, escapeRegex } from "../utils/fs.js";

export const GRIMOIRE_START_MARKER = "<!-- GRIMOIRE:START -->";
export const GRIMOIRE_END_MARKER = "<!-- GRIMOIRE:END -->";

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
  "grimoire-commit",
  "grimoire-pr",
  "grimoire-refactor",
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
 * Read the package AGENTS.md and upsert its content into the project's AGENTS.md.
 */
export async function upsertAgentsFile(
  root: string,
  packageRoot: string,
  verb: "created" | "updated"
): Promise<void> {
  const agentsPath = join(root, "AGENTS.md");
  const grimoireAgents = await readFile(
    join(packageRoot, "AGENTS.md"),
    "utf-8"
  );
  const managedBlock = buildManagedBlock(grimoireAgents);
  await upsertManagedBlock(agentsPath, managedBlock, verb, "AGENTS.md");
}

/**
 * Copy SKILL.md files from the package into the project's .claude/skills directory.
 */
export async function installSkillFiles(
  root: string,
  packageRoot: string,
  skillNames: string[],
  verb: "created" | "updated"
): Promise<void> {
  const skillsDir = join(root, ".claude", "skills");
  const sourceSkillsDir = join(packageRoot, "skills");

  for (const skill of skillNames) {
    const destDir = join(skillsDir, skill);
    await mkdir(destDir, { recursive: true });

    const src = join(sourceSkillsDir, skill, "SKILL.md");
    const dest = join(destDir, "SKILL.md");
    await copyFile(src, dest);
    const color = verb === "created" ? chalk.green : chalk.blue;
    console.log(`  ${color(verb)} .claude/skills/${skill}/SKILL.md`);
  }
}
