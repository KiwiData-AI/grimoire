import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import chalk from "chalk";
import { findProjectRoot } from "../utils/paths.js";
import { fileExists } from "../utils/fs.js";

interface ChangeInfo {
  id: string;
  status: string;
  branch: string | null;
  stage: string;
  hasManifest: boolean;
  hasTasks: boolean;
  hasFeatures: boolean;
  hasDecisions: boolean;
  featureFiles: string[];
}

export async function listChanges(json: boolean): Promise<void> {
  const root = await findProjectRoot();
  const changesDir = join(root, ".grimoire", "changes");

  try {
    const entries = await readdir(changesDir, { withFileTypes: true });
    const changes = entries.filter((e) => e.isDirectory());

    if (changes.length === 0) {
      if (json) {
        console.log(JSON.stringify([]));
      } else {
        console.log("No active changes.");
      }
      return;
    }

    const results: ChangeInfo[] = [];
    for (const change of changes) {
      const changePath = join(changesDir, change.name);
      const hasManifest = await fileExists(join(changePath, "manifest.md"));
      const hasTasks = await fileExists(join(changePath, "tasks.md"));

      const glob = (await import("fast-glob")).default;
      const featureFiles = await glob("features/**/*.feature", {
        cwd: changePath,
      });
      const hasFeatures = featureFiles.length > 0;
      const hasDecisions = await dirHasFiles(
        join(changePath, "decisions"),
        ".md"
      );

      // Parse manifest frontmatter
      let status = "draft";
      let branch: string | null = null;
      if (hasManifest) {
        const manifestContent = await readFile(
          join(changePath, "manifest.md"),
          "utf-8"
        );
        if (manifestContent.startsWith("---")) {
          const frontmatter = manifestContent.split("---")[1] || "";
          const statusMatch = frontmatter.match(/status:\s*(\S+)/);
          if (statusMatch) status = statusMatch[1];
          const branchMatch = frontmatter.match(/branch:\s*(\S+)/);
          if (branchMatch) branch = branchMatch[1];
        }
      }

      let stage = "draft";
      if (hasTasks) stage = "planned";

      results.push({
        id: change.name,
        status,
        branch,
        stage,
        hasManifest,
        hasTasks,
        hasFeatures,
        hasDecisions,
        featureFiles,
      });
    }

    // Detect conflicts: multiple changes touching the same feature file
    const conflicts = detectConflicts(results);

    if (json) {
      console.log(
        JSON.stringify({ changes: results, conflicts }, null, 2)
      );
    } else {
      console.log(chalk.bold("Active changes:\n"));
      for (const r of results) {
        const artifacts = [
          r.hasManifest ? "manifest" : null,
          r.hasFeatures ? "features" : null,
          r.hasDecisions ? "decisions" : null,
          r.hasTasks ? "tasks" : null,
        ]
          .filter(Boolean)
          .join(", ");

        const branchInfo = r.branch
          ? ` ${chalk.dim(`→ ${r.branch}`)}`
          : "";
        console.log(
          `  ${chalk.cyan(r.id)} ${chalk.dim(`[${r.status}]`)} — ${artifacts}${branchInfo}`
        );
      }

      if (conflicts.length > 0) {
        console.log(chalk.bold.yellow("\nConflicts detected:\n"));
        for (const c of conflicts) {
          console.log(
            `  ${chalk.yellow("!")} ${chalk.bold(c.file)} is touched by: ${c.changes.join(", ")}`
          );
        }
        console.log(
          chalk.dim(
            "\n  These changes modify the same feature file. Coordinate before applying."
          )
        );
      }
    }
  } catch {
    if (json) {
      console.log(JSON.stringify({ changes: [], conflicts: [] }));
    } else {
      console.log("No .grimoire/changes/ directory. Run grimoire init first.");
    }
  }
}

interface Conflict {
  file: string;
  changes: string[];
}

function detectConflicts(changes: ChangeInfo[]): Conflict[] {
  const fileToChanges = new Map<string, string[]>();

  for (const change of changes) {
    for (const file of change.featureFiles) {
      const existing = fileToChanges.get(file) || [];
      existing.push(change.id);
      fileToChanges.set(file, existing);
    }
  }

  const conflicts: Conflict[] = [];
  for (const [file, changeIds] of fileToChanges) {
    if (changeIds.length > 1) {
      conflicts.push({ file, changes: changeIds });
    }
  }

  return conflicts;
}

export async function listFeatures(json: boolean): Promise<void> {
  const root = await findProjectRoot();
  const glob = (await import("fast-glob")).default;
  const features = await glob("features/**/*.feature", {
    cwd: root,
    absolute: false,
  });

  if (json) {
    console.log(JSON.stringify(features));
  } else {
    if (features.length === 0) {
      console.log("No feature files found.");
      return;
    }
    console.log(chalk.bold("Feature files:\n"));
    for (const f of features) {
      console.log(`  ${f}`);
    }
  }
}

export async function listDecisions(json: boolean): Promise<void> {
  const root = await findProjectRoot();
  const glob = (await import("fast-glob")).default;
  const decisions = await glob(".grimoire/decisions/[0-9]*.md", {
    cwd: root,
    absolute: false,
  });

  if (json) {
    console.log(JSON.stringify(decisions));
  } else {
    if (decisions.length === 0) {
      console.log("No decision records found.");
      return;
    }
    console.log(chalk.bold("Decision records:\n"));
    for (const d of decisions) {
      const content = await readFile(join(root, d), "utf-8");
      const titleMatch = content.match(/^# (.+)$/m);
      const title = titleMatch ? titleMatch[1] : d;
      console.log(`  ${chalk.dim(d.replace(".grimoire/decisions/", ""))} ${title}`);
    }
  }
}

// fileExists imported from utils/fs.js

async function dirHasFiles(dir: string, ext: string): Promise<boolean> {
  try {
    const entries = await readdir(dir, { recursive: true });
    return entries.some((e) => e.endsWith(ext));
  } catch {
    return false;
  }
}
