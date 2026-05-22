import { readFile, mkdir, cp, rm } from "node:fs/promises";
import { join } from "node:path";
import chalk from "chalk";
import { findProjectRoot, resolveChangePath } from "../utils/paths.js";

interface ArchiveOptions {
  yes: boolean;
}

export class ArchiveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ArchiveError";
  }
}

async function checkPendingTasks(changePath: string, yes: boolean): Promise<void> {
  try {
    const tasksContent = await readFile(join(changePath, "tasks.md"), "utf-8");
    const pending = tasksContent.match(/^- \[ \] .+$/gm) || [];
    if (pending.length > 0) {
      console.log(chalk.yellow(`Warning: ${pending.length} task(s) still pending.`));
      if (!yes) throw new ArchiveError("Use --yes to archive anyway, or complete tasks first.");
    }
  } catch (err) {
    if (err instanceof ArchiveError) throw err;
    // No tasks file — ok
  }
}

async function getUserConfirmation(changeId: string): Promise<boolean> {
  const readline = await import("node:readline/promises");
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(`Archive change "${changeId}"? (y/N) `);
  rl.close();
  return answer.toLowerCase() === "y";
}

async function syncArtifactsToBaseline(changePath: string, root: string): Promise<void> {
  try {
    await cp(join(changePath, "features"), join(root, "features"), { recursive: true, force: true });
    console.log(`  ${chalk.green("synced")} features to baseline`);
  } catch {
    // No proposed features
  }
  try {
    // TODO: handle sequential numbering for new decisions
    await cp(join(changePath, "decisions"), join(root, ".grimoire", "decisions"), { recursive: true, force: true });
    console.log(`  ${chalk.green("synced")} decisions to baseline`);
  } catch {
    // No proposed decisions
  }
}

export async function archiveChange(
  changeId: string,
  options: ArchiveOptions
): Promise<void> {
  const root = await findProjectRoot();
  const changePath = resolveChangePath(root, changeId);

  try {
    await readFile(join(changePath, "manifest.md"), "utf-8");
  } catch {
    throw new ArchiveError(`Change "${changeId}" not found or missing manifest.`);
  }

  await checkPendingTasks(changePath, options.yes);

  if (!options.yes) {
    if (!(await getUserConfirmation(changeId))) {
      console.log("Cancelled.");
      return;
    }
  }

  await syncArtifactsToBaseline(changePath, root);

  const date = new Date().toISOString().split("T")[0];
  const archiveDir = join(root, ".grimoire", "archive", `${date}-${changeId}`);
  await mkdir(archiveDir, { recursive: true });
  await cp(join(changePath, "manifest.md"), join(archiveDir, "manifest.md"));
  try {
    await cp(join(changePath, "tasks.md"), join(archiveDir, "tasks.md"));
  } catch {
    // no tasks
  }

  await rm(changePath, { recursive: true });
  console.log(`\n${chalk.green("Archived")} ${changeId} → .grimoire/archive/${date}-${changeId}/`);
}
