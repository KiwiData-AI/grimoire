import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import chalk from "chalk";
import { matter } from "../utils/frontmatter.js";
import { findProjectRoot } from "../utils/paths.js";
import { fileExists } from "../utils/fs.js";
import fg from "fast-glob";

interface ChangeInfo {
  id: string;
  status: string;
  branch: string | null;
  stage: string;
  hasManifest: boolean;
  hasTasks: boolean;
  hasDraft: boolean;
  hasLearnings: boolean;
}

async function buildChangeInfo(changePath: string, changeName: string): Promise<ChangeInfo> {
  const [hasManifest, hasTasks, hasDraft, hasLearnings] = await Promise.all([
    fileExists(join(changePath, "manifest.md")),
    fileExists(join(changePath, "tasks.md")),
    fileExists(join(changePath, "draft.md")),
    fileExists(join(changePath, "learnings.md")),
  ]);

  let status = "draft";
  let branch: string | null = null;
  if (hasManifest) {
    const manifestContent = await readFile(join(changePath, "manifest.md"), "utf-8");
    const fm = matter(manifestContent).data as { status?: string; branch?: string };
    if (fm.status) status = fm.status;
    if (fm.branch) branch = fm.branch;
  }

  return {
    id: changeName,
    status,
    branch,
    stage: hasTasks ? "planned" : "draft",
    hasManifest,
    hasTasks,
    hasDraft,
    hasLearnings,
  };
}

function printChangeListOutput(results: ChangeInfo[]): void {
  console.log(chalk.bold("Active changes:\n"));
  for (const r of results) {
    const artifacts = [
      r.hasManifest ? "manifest" : null,
      r.hasTasks ? "tasks" : null,
      r.hasDraft ? "draft" : null,
      r.hasLearnings ? "learnings" : null,
    ].filter(Boolean).join(", ");
    const branchInfo = r.branch ? ` ${chalk.dim(`→ ${r.branch}`)}` : "";
    console.log(`  ${chalk.cyan(r.id)} ${chalk.dim(`[${r.status}]`)} — ${artifacts}${branchInfo}`);
  }
}

export async function listChanges(json: boolean): Promise<void> {
  const root = await findProjectRoot();
  const changesDir = join(root, ".grimoire", "changes");

  let entries;
  try {
    entries = await readdir(changesDir, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    if (json) console.log(JSON.stringify({ changes: [] }));
    else console.log("No .grimoire/changes/ directory. Run grimoire init first.");
    return;
  }

  const changes = entries.filter((entry) => entry.isDirectory());
  if (changes.length === 0) {
    if (json) console.log(JSON.stringify([]));
    else console.log("No active changes.");
    return;
  }

  const results: ChangeInfo[] = [];
  for (const change of changes) {
    results.push(await buildChangeInfo(join(changesDir, change.name), change.name));
  }

  if (json) {
    console.log(JSON.stringify({ changes: results }, null, 2));
  } else {
    printChangeListOutput(results);
  }
}

export async function listFeatures(json: boolean): Promise<void> {
  const root = await findProjectRoot();
  const features = await fg("features/**/*.feature", {
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
  const decisions = await fg(".grimoire/decisions/[0-9]*.md", {
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
