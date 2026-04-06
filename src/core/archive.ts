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

export async function archiveChange(
  changeId: string,
  options: ArchiveOptions
): Promise<void> {
  const root = await findProjectRoot();
  const changePath = resolveChangePath(root, changeId);

  // Check change exists
  try {
    await readFile(join(changePath, "manifest.md"), "utf-8");
  } catch {
    throw new ArchiveError(
      `Change "${changeId}" not found or missing manifest.`
    );
  }

  // Check tasks are complete
  try {
    const tasksContent = await readFile(
      join(changePath, "tasks.md"),
      "utf-8"
    );
    const pending =
      tasksContent.match(/^- \[ \] .+$/gm) || [];
    if (pending.length > 0) {
      console.log(
        chalk.yellow(
          `Warning: ${pending.length} task(s) still pending.`
        )
      );
      if (!options.yes) {
        throw new ArchiveError(
          "Use --yes to archive anyway, or complete tasks first."
        );
      }
    }
  } catch (err) {
    if (err instanceof ArchiveError) throw err;
    // No tasks file — that's ok for archiving
  }

  // Confirmation
  if (!options.yes) {
    const readline = await import("node:readline/promises");
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    const answer = await rl.question(
      `Archive change "${changeId}"? (y/N) `
    );
    rl.close();
    if (answer.toLowerCase() !== "y") {
      console.log("Cancelled.");
      return;
    }
  }

  // Copy proposed features to baseline
  const proposedFeatures = join(changePath, "features");
  try {
    await cp(proposedFeatures, join(root, "features"), {
      recursive: true,
      force: true,
    });
    console.log(
      `  ${chalk.green("synced")} features to baseline`
    );
  } catch {
    // No proposed features
  }

  // Copy proposed decisions to baseline
  const proposedDecisions = join(changePath, "decisions");
  try {
    // TODO: handle sequential numbering for new decisions
    await cp(proposedDecisions, join(root, ".grimoire", "decisions"), {
      recursive: true,
      force: true,
    });
    console.log(
      `  ${chalk.green("synced")} decisions to baseline`
    );
  } catch {
    // No proposed decisions
  }

  // Move manifest to archive
  const date = new Date().toISOString().split("T")[0];
  const archiveDir = join(
    root,
    ".grimoire",
    "archive",
    `${date}-${changeId}`
  );
  await mkdir(archiveDir, { recursive: true });

  await cp(join(changePath, "manifest.md"), join(archiveDir, "manifest.md"));

  // Copy tasks.md to archive if it exists
  try {
    await cp(
      join(changePath, "tasks.md"),
      join(archiveDir, "tasks.md")
    );
  } catch {
    // no tasks
  }

  // Remove change directory
  await rm(changePath, { recursive: true });

  console.log(
    `\n${chalk.green("Archived")} ${changeId} → .grimoire/archive/${date}-${changeId}/`
  );
}
