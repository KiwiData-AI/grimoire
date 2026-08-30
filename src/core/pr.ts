import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import chalk from "chalk";
import { simpleGit } from "simple-git";
import { getLlmArgs, loadConfig } from "../utils/config.js";
import { findProjectRoot, resolveChangePath } from "../utils/paths.js";
import { spawnWithStdin } from "../utils/spawn.js";

const execFileAsync = promisify(execFile);

interface PrOptions {
  changeId?: string;
  base?: string;
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

interface ChangeCommit {
  hash: string;
  subject: string;
  body: string;
  changeIds: string[];
}

export async function generatePr(options: PrOptions): Promise<void> {
  const context = await preparePr(options);

  let reviewOutput: string | undefined;
  if (options.review) {
    reviewOutput = await runPostImplReview(
      context.root,
      context.base,
      context.llmCommand,
      context.body
    );
  }

  const output: PrOutput = {
    title: context.title,
    body: context.body,
    changeId: context.changeId,
    review: reviewOutput,
  };

  if (options.json) {
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  printPrPreview(output, context.taskProgress);

  if (options.create) {
    await createPr(context.root, context.base, context.title, context.body);
  } else {
    console.log(
      chalk.dim("\nRun with --create to create the PR via gh/glab.")
    );
  }
}

async function preparePr(options: PrOptions) {
  const root = await findProjectRoot();
  const config = await loadConfig(root);
  const changesDir = join(root, ".grimoire", "changes");
  const base = await resolveBaseBranch(root, options.base);
  const commits = await readBranchCommits(root, base);

  const changeId = await resolveChangeId(changesDir, options.changeId, commits);
  const changeDir = resolveChangePath(root, changeId);
  const manifest = await readFileOrEmpty(join(changeDir, "manifest.md"));
  const tasks = await readFileOrEmpty(join(changeDir, "tasks.md"));
  const changeCommits = commits.filter((commit) => commit.changeIds.includes(changeId));
  if (!manifest && changeCommits.length === 0) {
    throw new Error(`No commits found for change "${changeId}".`);
  }

  const changedPaths = await readChangedPaths(root, base, commits);
  const { features, decisions } = await readPrArtifacts(
    root,
    changeDir,
    changedPaths,
    config.features_dir,
    config.decisions_dir
  );

  const whySection = extractSection(manifest, "Why") || extractCommitSummary(changeCommits);
  const featureChanges = extractSection(manifest, "Feature Changes") || formatCommitChanges(commits);
  const scenarios = extractScenarios(features);
  const decisionTitles = extractDecisionTitles(decisions);
  const taskProgress = tasks ? countTasks(tasks) : undefined;

  const manifestTitle = extractTitle(manifest);
  const commitStyle = config.project.commit_style ?? "conventional";
  const title = manifest
    ? formatTitle(manifestTitle, changeId, commitStyle)
    : formatCommitTitle(selectTitleCommit(changeCommits).subject, changeId, commitStyle);

  const body = composePrBody({
    why: whySection,
    featureChanges,
    scenarios,
    decisionTitles,
    taskProgress,
    changeId,
  });

  return {
    root,
    base,
    title,
    body,
    changeId,
    taskProgress,
    llmCommand: config.llm.coding.command,
  };
}

async function resolveChangeId(
  changesDir: string,
  explicitChange: string | undefined,
  commits: ChangeCommit[]
): Promise<string> {
  const activeChange = explicitChange ? null : await detectActiveChange(changesDir);
  const changeId = selectChange(explicitChange, activeChange, commits);
  if (!changeId) {
    throw new Error("No active change found. Specify a change ID.");
  }
  return changeId;
}

async function readPrArtifacts(
  root: string,
  changeDir: string,
  changedPaths: string[],
  featuresDir: string,
  decisionsDir: string
): Promise<{ features: string[]; decisions: string[] }> {
  const liveFeatures = await readChangedArtifactFiles(root, changedPaths, featuresDir, ".feature");
  const liveDecisions = await readChangedArtifactFiles(root, changedPaths, decisionsDir, ".md");
  const features = liveFeatures.length > 0
    ? liveFeatures
    : await readArtifactFiles(changeDir, "features", ".feature");
  const decisions = liveDecisions.length > 0
    ? liveDecisions
    : await readArtifactFiles(changeDir, "decisions", ".md");
  return { features, decisions };
}

function printPrPreview(
  output: PrOutput,
  taskProgress?: { complete: number; incomplete: number }
): void {
  console.log(chalk.bold("\nPR Preview\n"));
  console.log(chalk.bold("Title: ") + output.title);
  console.log(chalk.dim("─".repeat(60)));
  console.log(output.body);

  if (taskProgress && taskProgress.incomplete > 0) {
    console.log(chalk.yellow(
      `\n⚠ ${taskProgress.incomplete} task(s) still incomplete — consider finishing before creating PR.`
    ));
  }

  if (output.review) {
    console.log(chalk.dim("─".repeat(60)));
    console.log(chalk.bold("\nPost-Implementation Review:\n"));
    console.log(output.review);
  }
}

async function resolveBaseBranch(root: string, explicitBase?: string): Promise<string> {
  if (explicitBase) return explicitBase;

  try {
    const remoteHead = await simpleGit(root).raw([
      "symbolic-ref",
      "--quiet",
      "--short",
      "refs/remotes/origin/HEAD",
    ]);
    return remoteHead.trim().replace(/^[^/]+\//, "") || "main";
  } catch {
    return "main";
  }
}

async function readBranchCommits(root: string, base: string): Promise<ChangeCommit[]> {
  try {
    const output = await simpleGit(root).raw([
      "log",
      `${base}..HEAD`,
      "--reverse",
      "--format=%H%x1f%s%x1f%b%x1e",
    ]);
    return output.split("\x1e").flatMap((record) => {
      const [hash, subject, body] = record.trim().split("\x1f");
      const changeIds = body?.match(/^Change:\s*(.+)$/gim)
        ?.map((line) => line.replace(/^Change:\s*/i, "").trim()) ?? [];
      if (!hash || !subject || changeIds.length === 0) return [];
      return [{
        hash: hash.trim(),
        subject: subject.trim(),
        body: body.trim(),
        changeIds,
      }];
    });
  } catch {
    return [];
  }
}

function selectChange(
  explicitChange: string | undefined,
  activeChange: string | null,
  commits: ChangeCommit[]
): string | null {
  if (explicitChange) return explicitChange;

  const changeIds = new Set(commits.flatMap((commit) => commit.changeIds));
  if (changeIds.size > 1) {
    throw new Error("Multiple changes found in branch history. Specify one: grimoire pr <change-id>");
  }
  const branchChange = changeIds.values().next().value ?? null;
  if (activeChange && branchChange && activeChange !== branchChange) {
    throw new Error("Multiple changes found in branch history. Specify one: grimoire pr <change-id>");
  }
  return branchChange ?? activeChange;
}

async function readChangedPaths(
  root: string,
  base: string,
  commits: ChangeCommit[]
): Promise<string[]> {
  try {
    const git = simpleGit(root);
    const output = await git.diff(["--name-only", `${base}...HEAD`]);
    const branchPaths = output.trim().split("\n").filter(Boolean);
    if (commits.length === 0) return branchPaths;

    const selectedPaths = new Set<string>();
    for (const commit of commits) {
      const paths = await git.raw(["show", "--format=", "--name-only", commit.hash]);
      for (const path of paths.trim().split("\n").filter(Boolean)) selectedPaths.add(path);
    }
    return branchPaths.filter((path) => selectedPaths.has(path));
  } catch {
    return [];
  }
}

async function readChangedArtifactFiles(
  root: string,
  paths: string[],
  artifactDir: string,
  extension: string
): Promise<string[]> {
  const prefix = `${artifactDir.replace(/\/$/, "")}/`;
  const contents: string[] = [];
  for (const path of paths.filter((path) => path.startsWith(prefix) && path.endsWith(extension))) {
    const content = await readFileOrEmpty(join(root, path));
    if (content) contents.push(content);
  }
  return contents;
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

function extractCommitSummary(commits: ChangeCommit[]): string {
  return commits.map((commit) => {
    const body = commit.body
      .split("\n")
      .filter((line) => !/^(Change|Scenarios|Decisions|Final-production-review):/i.test(line.trim()))
      .join("\n")
      .trim();
    return body || commit.subject;
  }).filter(Boolean).join("\n\n");
}

function formatCommitChanges(commits: ChangeCommit[]): string {
  return commits.map((commit) => `- ${commit.subject}`).join("\n");
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

function formatCommitTitle(subject: string, changeId: string, style: string): string {
  return /^[a-z]+(?:\([^)]+\))?!?:\s/i.test(subject)
    ? subject
    : formatTitle(subject, changeId, style);
}

function selectTitleCommit(commits: ChangeCommit[]): ChangeCommit {
  return [...commits].reverse().find((commit) => /^(feat|fix)(?:\([^)]+\))?!?:\s/i.test(commit.subject))
    ?? commits.at(-1)!;
}

function composePrBody(data: {
  why: string;
  featureChanges: string;
  scenarios: string[];
  decisionTitles: string[];
  taskProgress?: { complete: number; incomplete: number };
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

  if (data.taskProgress) {
    const total = data.taskProgress.complete + data.taskProgress.incomplete;
    sections.push(`Tasks: ${data.taskProgress.complete}/${total} complete`);
    sections.push("");
  }
  sections.push(`Change: ${data.changeId}`);

  return sections.join("\n");
}

async function runPostImplReview(
  root: string,
  base: string,
  llmCommand: string,
  prBody: string
): Promise<string> {
  try {
    const git = simpleGit(root);
    const diff = await git.diff([`${base}...HEAD`]);

    if (!diff.trim()) {
      return `No diff found against ${base}. Skipping review.`;
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

    const output = await spawnWithStdin(llmCommand, getLlmArgs(llmCommand), prompt, root);
    return output;
  } catch (err) {
    return `Review failed: ${err instanceof Error ? err.message : "unknown error"}`;
  }
}

async function createPr(
  root: string,
  base: string,
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
        ? ["pr", "create", "--base", base, "--title", title, "--body", body]
        : ["mr", "create", "--target-branch", base, "--title", title, "--description", body];

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
