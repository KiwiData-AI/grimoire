import { readFile, writeFile, copyFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import chalk from "chalk";
import { fileExists, escapeRegex } from "../utils/fs.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = join(__dirname, "..", "..");

interface UpdateOptions {
  skipAgents: boolean;
  skipSkills: boolean;
}

export async function updateProject(
  projectPath: string,
  options: UpdateOptions
): Promise<void> {
  const root = join(process.cwd(), projectPath);

  // Verify this is a grimoire project
  if (!(await exists(join(root, ".grimoire")))) {
    throw new Error("No .grimoire/ directory found. Run grimoire init first.");
  }

  console.log(chalk.bold("Updating grimoire...\n"));

  if (!options.skipAgents) {
    await updateAgentsFile(root);
  }

  if (!options.skipSkills) {
    await updateSkills(root);
  }

  console.log(`\n${chalk.bold.green("Done!")} Grimoire updated.`);
}

async function updateAgentsFile(root: string): Promise<void> {
  const agentsPath = join(root, "AGENTS.md");
  const grimoireAgents = await readFile(
    join(PACKAGE_ROOT, "AGENTS.md"),
    "utf-8"
  );

  const marker = "<!-- GRIMOIRE:START -->";
  const endMarker = "<!-- GRIMOIRE:END -->";
  const managedBlock = `${marker}\n${grimoireAgents}\n${endMarker}`;

  if (await exists(agentsPath)) {
    const existing = await readFile(agentsPath, "utf-8");

    if (existing.includes(marker)) {
      const updated = existing.replace(
        new RegExp(
          `${escapeRegex(marker)}[\\s\\S]*?${escapeRegex(endMarker)}`
        ),
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

async function updateSkills(root: string): Promise<void> {
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
  ];

  for (const skill of skillNames) {
    const destDir = join(skillsDir, skill);
    await mkdir(destDir, { recursive: true });

    const src = join(sourceSkillsDir, skill, "SKILL.md");
    const dest = join(destDir, "SKILL.md");
    await copyFile(src, dest);
    console.log(`  ${chalk.blue("updated")} .claude/skills/${skill}/SKILL.md`);
  }
}

const exists = fileExists;
