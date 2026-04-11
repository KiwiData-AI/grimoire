import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import chalk from "chalk";
import { simpleGit } from "simple-git";
import { loadConfig } from "../utils/config.js";
import { findProjectRoot, resolveChangePath } from "../utils/paths.js";
import { spawnWithStdin } from "../utils/spawn.js";

const execFileAsync = promisify(execFile);

interface PrOptions {
  changeId?: string;
  create: boolean;
  review: boolean;
  json: boolean;
}

interface PrOutput {
  title: string;
  body: string;
  changeId: string;
  review?: string;
}

export async function generatePr(options: PrOptions): Promise<void> {
  const root = await findProjectRoot();
  const config = await loadConfig(root);
  const changesDir = join(root, ".grimoire", "changes");

  // Find the change
  const changeId = options.changeId ?? (await detectActiveChange(changesDir));
  if (!changeId) {
    throw new Error("No active change found. Specify a change ID.");
  }

  const changeDir = resolveChangePath(root, changeId);

  // Read artifacts
  const manifest = await readFileOrEmpty(join(changeDir, "manifest.md"));
  const tasks = await readFileOrEmpty(join(changeDir, "tasks.md"));
  const features = await readArtifactFiles(changeDir, "features", ".feature");
  const decisions = await readArtifactFiles(changeDir, "decisions", ".md");

  // Parse manifest
  const whySection = extractSection(manifest, "Why");
  const featureChanges = extractSection(manifest, "Feature Changes");
  const scenarios = extractScenarios(features);
  const decisionTitles = extractDecisionTitles(decisions);
  const taskProgress = countTasks(tasks);

  // Generate title
  const manifestTitle = extractTitle(manifest);
  const commitStyle = config.project.commit_style ?? "conventional";
  const title = formatTitle(manifestTitle, changeId, commitStyle);

  // Generate body
  const body = composePrBody({
    why: whySection,
    featureChanges,
    scenarios,
    decisionTitles,
    taskProgress,
    changeId,
  });

  // Optional review
  let reviewOutput: string | undefined;
  if (options.review) {
    reviewOutput = await runPostImplReview(root, config.llm.coding.command, body);
  }

  const output: PrOutput = { title, body, changeId, review: reviewOutput };

  if (options.json) {
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  // Display
  console.log(chalk.bold("\nPR Preview\n"));
  console.log(chalk.bold("Title: ") + title);
  console.log(chalk.dim("─".repeat(60)));
  console.log(body);

  if (taskProgress.incomplete > 0) {
    console.log(
      chalk.yellow(
        `\n⚠ ${taskProgress.incomplete} task(s) still incomplete — consider finishing before creating PR.`
      )
    );
  }

  if (reviewOutput) {
    console.log(chalk.dim("─".repeat(60)));
    console.log(chalk.bold("\nPost-Implementation Review:\n"));
    console.log(reviewOutput);
  }

  // Create PR if requested
  if (options.create) {
    await createPr(root, title, body);
  } else {
    console.log(
      chalk.dim("\nRun with --create to create the PR via gh/glab.")
    );
  }
}

async function detectActiveChange(changesDir: string): Promise<string | null> {
  let entries;
  try {
    entries = await readdir(changesDir, { withFileTypes: true });
  } catch {
    return null;
  }

  const changes = entries.filter((e) => e.isDirectory()).map((e) => e.name);
  if (changes.length === 1) return changes[0];
  if (changes.length > 1) {
    console.log(chalk.bold("Active changes:"));
    for (const c of changes) {
      console.log(`  - ${c}`);
    }
    throw new Error("Multiple active changes. Specify one: grimoire pr <change-id>");
  }
  return null;
}

async function readFileOrEmpty(path: string): Promise<string> {
  try {
    return await readFile(path, "utf-8");
  } catch {
    return "";
  }
}

async function readArtifactFiles(changeDir: string, subdir: string, ext: string): Promise<string[]> {
  const dir = join(changeDir, subdir);
  try {
    const files = await collectFiles(dir, ext);
    const contents: string[] = [];
    for (const f of files) {
      contents.push(await readFile(f, "utf-8"));
    }
    return contents;
  } catch {
    return [];
  }
}

async function collectFiles(dir: string, ext: string): Promise<string[]> {
  const result: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true, recursive: true });
  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith(ext)) {
      const parent = entry.parentPath ?? entry.path;
      result.push(join(parent, entry.name));
    }
  }
  return result;
}

function extractTitle(manifest: string): string {
  const match = manifest.match(/^#\s+Change:\s*(.+)/m);
  return match ? match[1].trim() : "Untitled change";
}

function extractSection(content: string, heading: string): string {
  const regex = new RegExp(
    `^##\\s+${heading}\\s*\n([\\s\\S]*?)(?=^##\\s|$)`,
    "m"
  );
  const match = content.match(regex);
  return match ? match[1].trim() : "";
}

function extractScenarios(features: string[]): string[] {
  const scenarios: string[] = [];
  for (const content of features) {
    const matches = content.matchAll(/^\s*Scenario(?:\s+Outline)?:\s*(.+)/gm);
    for (const m of matches) {
      scenarios.push(m[1].trim());
    }
  }
  return scenarios;
}

function extractDecisionTitles(decisions: string[]): string[] {
  const titles: string[] = [];
  for (const content of decisions) {
    const match = content.match(/^#\s+(.+)/m);
    if (match) titles.push(match[1].trim());
  }
  return titles;
}

function countTasks(tasks: string): { complete: number; incomplete: number } {
  const complete = (tasks.match(/- \[x\]/gi) || []).length;
  const incomplete = (tasks.match(/- \[ \]/g) || []).length;
  return { complete, incomplete };
}

function formatTitle(
  manifestTitle: string,
  changeId: string,
  style: string
): string {
  const cleanTitle = manifestTitle.toLowerCase().replace(/[^a-z0-9\s-]/g, "");

  const type = changeId.startsWith("fix-") ? "fix" : "feat";

  if (style === "angular") {
    // Try to extract scope from change-id
    const parts = changeId.replace(/^(add|update|fix|remove)-/, "").split("-");
    const scope = parts[0];
    return `${type}(${scope}): ${cleanTitle}`;
  }

  return `${type}: ${cleanTitle}`;
}

function composePrBody(data: {
  why: string;
  featureChanges: string;
  scenarios: string[];
  decisionTitles: string[];
  taskProgress: { complete: number; incomplete: number };
  changeId: string;
}): string {
  const sections: string[] = [];

  sections.push("## Summary");
  sections.push(data.why || "_No summary provided in manifest._");
  sections.push("");

  if (data.featureChanges) {
    sections.push("## Changes");
    sections.push(data.featureChanges);
    sections.push("");
  }

  if (data.scenarios.length > 0) {
    sections.push("## Scenarios");
    for (const s of data.scenarios) {
      sections.push(`- "${s}"`);
    }
    sections.push("");
  }

  if (data.decisionTitles.length > 0) {
    sections.push("## Decisions");
    for (const d of data.decisionTitles) {
      sections.push(`- ${d}`);
    }
    sections.push("");
  }

  sections.push("## Test Plan");
  sections.push("- [ ] All new feature scenarios pass");
  sections.push("- [ ] No regressions in existing tests");
  if (data.decisionTitles.length > 0) {
    sections.push("- [ ] ADR confirmation criteria met");
  }
  sections.push("");

  const total = data.taskProgress.complete + data.taskProgress.incomplete;
  sections.push(
    `Tasks: ${data.taskProgress.complete}/${total} complete`
  );
  sections.push("");
  sections.push(`Change: ${data.changeId}`);

  return sections.join("\n");
}

async function runPostImplReview(
  root: string,
  llmCommand: string,
  prBody: string
): Promise<string> {
  try {
    const git = simpleGit(root);
    const diff = await git.diff(["main...HEAD"]);

    if (!diff.trim()) {
      return "No diff found against main. Skipping review.";
    }

    // Truncate diff if very large
    const maxDiffLen = 50_000;
    const truncatedDiff =
      diff.length > maxDiffLen
        ? diff.slice(0, maxDiffLen) + "\n\n... (diff truncated)"
        : diff;

    const prompt = `Review this pull request for issues the design review might have missed now that real code exists.

PR Description:
${prBody}

Diff:
${truncatedDiff}

Focus on:
- Implementation doesn't match the scenarios described
- Missing error handling for edge cases in the scenarios
- Security issues in the actual code
- Dependencies added that weren't in the plan
- Files changed that aren't covered by the task list (scope creep)
- Test quality: are step definitions making real assertions?

Flag issues as **blocker** or **suggestion**. Be concise.`;

    const output = await spawnWithStdin(llmCommand, ["--print"], prompt, root);
    return output;
  } catch (err) {
    return `Review failed: ${err instanceof Error ? err.message : "unknown error"}`;
  }
}

async function createPr(
  root: string,
  title: string,
  body: string
): Promise<void> {
  // Try gh first, then glab
  for (const tool of ["gh", "glab"]) {
    try {
      await execFileAsync("which", [tool]);
    } catch {
      continue;
    }

    const createCmd =
      tool === "gh"
        ? ["pr", "create", "--title", title, "--body", body]
        : ["mr", "create", "--title", title, "--description", body];

    try {
      const { stdout } = await execFileAsync(tool, createCmd, {
        cwd: root,
        timeout: 30_000,
      });
      console.log(chalk.green(`\nPR created: ${stdout.trim()}`));
      return;
    } catch (err) {
      console.error(
        chalk.red(
          `\nFailed to create PR via ${tool}: ${err instanceof Error ? err.message : "unknown error"}`
        )
      );
      return;
    }
  }

  console.error(
    chalk.red(
      "\nNeither gh nor glab found. Install GitHub CLI (gh) or GitLab CLI (glab) to create PRs."
    )
  );
}

