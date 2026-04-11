import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import chalk from "chalk";
import { fileExists } from "../utils/fs.js";
import { loadConfig } from "../utils/config.js";
import { upsertAgentsFile, installSkillFiles, SKILL_NAMES } from "./shared-setup.js";

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
  const config = await loadConfig(root);
  const caveman = config.project.caveman ?? "none";
  await upsertAgentsFile(root, PACKAGE_ROOT, "updated", caveman);
}

async function updateSkills(root: string): Promise<void> {
  await installSkillFiles(root, PACKAGE_ROOT, SKILL_NAMES, "updated");
}

const exists = fileExists;
