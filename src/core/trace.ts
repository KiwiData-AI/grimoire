import { readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import chalk from "chalk";
import { simpleGit } from "simple-git";
import { findProjectRoot } from "../utils/paths.js";

interface TraceOptions {
  json: boolean;
}

interface TraceResult {
  file: string;
  line?: number;
  commits: CommitTrace[];
  changes: ChangeTrace[];
}

interface CommitTrace {
  hash: string;
  date: string;
  author: string;
  subject: string;
  changeId?: string;
}

interface ChangeTrace {
  changeId: string;
  date: string;
  summary: string;
  why: string;
  features: string[];
  decisions: string[];
  status: "active" | "merged";
}

function printChangeEntry(ch: ChangeTrace): void {
  const status =
    ch.status === "merged" ? chalk.green("merged") : chalk.yellow("active");
  console.log(`  ${chalk.cyan(ch.changeId)}  ${chalk.dim(ch.date)}  ${status}`);
  console.log(`  ${ch.summary}`);
  if (ch.why) console.log(`  ${chalk.dim("Why:")} ${ch.why}`);
  if (ch.features.length > 0) console.log(`  ${chalk.dim("Features:")} ${ch.features.join(", ")}`);
  if (ch.decisions.length > 0) console.log(`  ${chalk.dim("Decisions:")} ${ch.decisions.join(", ")}`);
  console.log();
}

function printTraceOutput(
  relFile: string,
  line: number | undefined,
  commits: CommitTrace[],
  changes: ChangeTrace[],
  changeIds: Set<string>,
): void {
  console.log(chalk.bold(`\nTrace: ${relFile}${line ? `:${line}` : ""}\n`));

  console.log(chalk.bold.underline("Commits\n"));
  for (const c of commits.slice(0, 20)) {
    const changeTag = c.changeId ? chalk.cyan(` [${c.changeId}]`) : "";
    console.log(`  ${chalk.dim(c.hash.slice(0, 8))}  ${chalk.dim(c.date)}  ${c.subject}${changeTag}`);
  }
  if (commits.length > 20) console.log(chalk.dim(`  ... and ${commits.length - 20} more`));

  if (changes.length > 0) {
    console.log(chalk.bold.underline("\nLinked Changes\n"));
    for (const ch of changes) printChangeEntry(ch);
  } else if (changeIds.size === 0) {
    console.log(chalk.dim("\nNo grimoire change IDs found in commit trailers.\nCommits without a Change: trailer are not linked to grimoire changes.\n"));
  }
}

export async function traceFile(
  target: string,
  options: TraceOptions
): Promise<void> {
  const root = await findProjectRoot();
  const { file, line } = parseTarget(target);
  const relFile = relative(root, join(process.cwd(), file));

  const commits = await getCommits(root, relFile, line);
  if (commits.length === 0) {
    console.log(chalk.dim(`No git history found for ${relFile}`));
    return;
  }

  const changeIds = new Set<string>();
  for (const c of commits) {
    if (c.changeId) changeIds.add(c.changeId);
  }

  const changes = await lookupChanges(root, changeIds);
  const result: TraceResult = { file: relFile, line, commits, changes };

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  printTraceOutput(relFile, line, commits, changes, changeIds);
}

function parseTarget(target: string): { file: string; line?: number } {
  // Match file.ts:42 or file.ts:10-20 (use start line)
  const match = target.match(/^(.+):(\d+)(?:-\d+)?$/);
  if (match) {
    return { file: match[1], line: parseInt(match[2], 10) };
  }
  return { file: target };
}

async function getCommits(
  root: string,
  relFile: string,
  line?: number
): Promise<CommitTrace[]> {
  const commits: CommitTrace[] = [];
  const git = simpleGit(root);

  try {
    // Use git log with trailer parsing
    // Format: hash|date|author|subject|trailers
    const args = [
      "log",
      "--format=%H%x1f%as%x1f%an%x1f%s%x1f%(trailers:key=Change,valueonly,separator=%x00)",
      "--follow",
    ];

    if (line) {
      args.push(`-L${line},${line}:${relFile}`);
      // -L doesn't support --follow, remove it
      args.splice(args.indexOf("--follow"), 1);
    } else {
      args.push("--", relFile);
    }

    const stdout = await git.raw(args);

    for (const rawLine of stdout.trim().split("\n")) {
      if (!rawLine) continue;

      // For -L format, git outputs diff lines too — only parse our format lines
      const parts = rawLine.split("\x1f");
      if (parts.length < 4) continue;
      if (!/^[0-9a-f]{40}$/.test(parts[0])) continue;

      const [hash, date, author, subject, ...trailerParts] = parts;
      const changeTrailer = trailerParts.join("").trim();

      commits.push({
        hash,
        date,
        author,
        subject,
        changeId: changeTrailer || undefined,
      });
    }
  } catch {
    // git log failed — likely not a git repo or file has no history
  }

  // Deduplicate (git -L can produce dupes)
  const seen = new Set<string>();
  return commits.filter((c) => {
    if (seen.has(c.hash)) return false;
    seen.add(c.hash);
    return true;
  });
}

async function lookupChanges(
  root: string,
  changeIds: Set<string>
): Promise<ChangeTrace[]> {
  const changes: ChangeTrace[] = [];

  for (const changeId of changeIds) {
    // An active change still has its manifest in .grimoire/changes/.
    const activeEntry = await findInActive(root, changeId);
    if (activeEntry) {
      changes.push(activeEntry);
      continue;
    }

    // Otherwise the change is finalized/merged — its record is git history,
    // not an archive tree. Reconstruct from the Change: commit trailer.
    const mergedEntry = await findInGit(root, changeId);
    if (mergedEntry) {
      changes.push(mergedEntry);
    }
  }

  // Sort by date, newest first
  changes.sort((a, b) => b.date.localeCompare(a.date));
  return changes;
}

async function findInActive(
  root: string,
  changeId: string
): Promise<ChangeTrace | null> {
  const manifestPath = join(root, ".grimoire", "changes", changeId, "manifest.md");

  try {
    const manifest = await readFile(manifestPath, "utf-8");
    const parsed = parseManifest(manifest);
    return {
      changeId,
      date: "(active)",
      status: "active",
      ...parsed,
    };
  } catch {
    return null;
  }
}

async function findInGit(
  root: string,
  changeId: string
): Promise<ChangeTrace | null> {
  const git = simpleGit(root);
  try {
    const stdout = await git.raw([
      "log",
      "--format=%as%x1f%s",
      `--grep=Change: ${changeId}`,
      "--fixed-strings",
    ]);

    const rows = stdout
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((l) => l.split("\x1f"));
    if (rows.length === 0) return null;

    const [date, subject] = rows[0];
    return {
      changeId,
      date: date ?? "",
      status: "merged",
      summary: subject ?? `(merged change ${changeId})`,
      why: "",
      features: [],
      decisions: [],
    };
  } catch {
    return null;
  }
}

function parseManifest(content: string): {
  summary: string;
  why: string;
  features: string[];
  decisions: string[];
} {
  const titleMatch = content.match(/^#\s+Change:\s*(.+)$/m);
  const summary = titleMatch ? titleMatch[1].trim() : "(no summary)";

  const whyMatch = content.match(
    /^##\s+Why\s*\n([\s\S]*?)(?=^##|\Z)/m
  );
  const why = whyMatch ? whyMatch[1].trim() : "";

  const features: string[] = [];
  const featurePattern = /\*\*(?:ADDED|MODIFIED|REMOVED)\*\*\s+`([^`]+\.feature)`/g;
  let m;
  while ((m = featurePattern.exec(content)) !== null) {
    features.push(m[1]);
  }

  const decisions: string[] = [];
  const decisionPattern = /\*\*(?:ADDED|MODIFIED|SUPERSEDED)\*\*\s+`(\d{4}-[^`]+\.md)`/g;
  while ((m = decisionPattern.exec(content)) !== null) {
    decisions.push(m[1]);
  }

  return { summary, why, features, decisions };
}
